import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer } from 'kafkajs';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { KafkaService } from '@app/common';
import {
  BOOK_OVERDUE,
  BOOK_RENTED,
  BOOK_RETURNED,
  BookOverdueEvent,
  BookRentedEvent,
  BookReturnedEvent,
  EventEnvelope,
  TOPICS,
} from '@app/contracts';
import { ProcessedEvent } from './entities/processed-event.entity';
import { EmailService } from './email.service';

/**
 * Consumes rental lifecycle events and sends transactional emails.
 *
 * Dedup pattern (same as inventory-service):
 *   1. Attempt INSERT INTO processed_events ON CONFLICT DO NOTHING inside a tx.
 *   2. If 0 rows inserted → already processed → skip.
 *   3. If 1 row inserted → commit tx, then send email (best-effort, at-most-once).
 *
 * The processed_event commit happens before the email so a duplicate Kafka
 * delivery never sends a second email, even if the first email call errored.
 */
@Injectable()
export class NotificationConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationConsumer.name);
  private consumer!: Consumer;

  constructor(
    private readonly kafka: KafkaService,
    private readonly email: EmailService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    this.consumer = this.kafka.createConsumer('notification-service');
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [TOPICS.BOOK_RENTED, TOPICS.BOOK_RETURNED, TOPICS.BOOK_OVERDUE],
      fromBeginning: true,
    });
    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;
        const event = await this.kafka.decode<EventEnvelope>(message.value);
        await this.handleEvent(topic, event);
      },
    });
    this.logger.log('notification consumer running');
  }

  /** Public so integration tests can drive it directly. */
  async handleEvent(topic: string, event: EventEnvelope): Promise<void> {
    const shouldProcess = await this.markProcessed(event.eventId, event.eventType);
    if (!shouldProcess) {
      this.logger.debug(`skipping duplicate event ${event.eventId}`);
      return;
    }

    try {
      if (event.eventType === BOOK_RENTED) {
        const { payload } = event as BookRentedEvent;
        // userId is the email address in this dev setup (same as auth-service seed)
        await this.email.sendBookRented(payload.userId, payload.bookId, payload.dueAt);
        this.logger.debug(`sent rent confirmation for rental ${payload.rentalId}`);
      } else if (event.eventType === BOOK_RETURNED) {
        const { payload } = event as BookReturnedEvent;
        await this.email.sendBookReturned(payload.userId, payload.bookId);
        this.logger.debug(`sent return confirmation for rental ${payload.rentalId}`);
      } else if (event.eventType === BOOK_OVERDUE) {
        const { payload } = event as BookOverdueEvent;
        await this.email.sendBookOverdue(payload.userId, payload.bookId, payload.dueAt);
        this.logger.debug(`sent overdue notice for rental ${payload.rentalId}`);
      } else {
        this.logger.warn(`ignoring unexpected event on ${topic}: ${event.eventType}`);
      }
    } catch (err) {
      // Email failed after we've already committed the dedup row — log and move
      // on. The processed_event ensures we don't retry on redeliver.
      this.logger.error(
        `email send failed for ${event.eventId} (${event.eventType}): ${(err as Error).message}`,
      );
    }
  }

  /**
   * Inserts into processed_events. Returns true if newly inserted (should
   * process), false if already seen (duplicate).
   */
  private async markProcessed(eventId: string, eventType: string): Promise<boolean> {
    const result = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(ProcessedEvent)
      .values({ eventId, eventType })
      .orIgnore()
      .execute();
    return result.raw.length > 0;
  }

  async onModuleDestroy() {
    await this.consumer?.disconnect();
  }
}
