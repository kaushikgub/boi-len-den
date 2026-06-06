import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { KafkaService } from '@app/common';
import { BookOverdueSchema, BookRentedSchema, BookReturnedSchema } from '@app/contracts';
import { OutboxMessage } from '../entities/outbox.entity';
import { validateEvent } from './event-validator';

/**
 * Polling outbox relay. Every tick it claims a batch of unpublished rows with
 * `FOR UPDATE SKIP LOCKED` (so multiple relay instances never grab the same row),
 * publishes each to Kafka via the schema registry, and marks it published — all
 * inside one transaction, so the row lock is held until the publish is confirmed.
 * A failed publish leaves published_at NULL for the next tick to retry.
 *
 * (Debezium CDC would replace this in a later slice; consumers don't care which.)
 */
@Injectable()
export class RelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RelayService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly batchSize: number;
  private readonly intervalMs: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly kafka: KafkaService,
    config: ConfigService,
  ) {
    this.batchSize = Number(config.get('OUTBOX_BATCH', '50'));
    this.intervalMs = Number(config.get('OUTBOX_POLL_MS', '500'));
  }

  async onModuleInit() {
    // rental-service is the producer, so it owns schema registration.
    await this.kafka.registerSchema('book-rented-value', BookRentedSchema);
    await this.kafka.registerSchema('book-returned-value', BookReturnedSchema);
    await this.kafka.registerSchema('book-overdue-value', BookOverdueSchema);

    this.timer = setInterval(() => {
      void this.poll();
    }, this.intervalMs);
    this.timer.unref?.();
    this.logger.log(`outbox relay polling every ${this.intervalMs}ms (batch ${this.batchSize})`);
  }

  /** Public so the integration test can drive a tick deterministically. */
  async poll(): Promise<number> {
    if (this.running) return 0; // never overlap ticks
    this.running = true;
    let published = 0;
    try {
      await this.dataSource.transaction(async (m) => {
        const rows = await m
          .createQueryBuilder(OutboxMessage, 'o')
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .where('o.publishedAt IS NULL')
          .orderBy('o.createdAt', 'ASC')
          .limit(this.batchSize)
          .getMany();

        for (const row of rows) {
          const { valid, errors } = validateEvent(row.eventType, row.payload);
          if (!valid) {
            row.attempts += 1;
            await m.save(row);
            this.logger.error(`poison outbox row ${row.eventId}: ${errors}`);
            continue;
          }
          try {
            await this.kafka.publish(row.topic, row.subject, row.messageKey, row.payload);
            row.publishedAt = new Date();
            await m.save(row);
            published += 1;
          } catch (err) {
            row.attempts += 1;
            await m.save(row);
            this.logger.error(`publish failed for ${row.eventId}: ${(err as Error).message}`);
          }
        }
      });
    } catch (err) {
      this.logger.error(`relay tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
    if (published > 0) this.logger.debug(`relay published ${published} event(s)`);
    return published;
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
