import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer } from 'kafkajs';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { KafkaService } from '@app/common';
import {
  EventEnvelope,
  PAYMENT_CHARGED,
  PaymentChargedEvent,
  TOPICS,
} from '@app/contracts';
import { Rental } from '../entities/rental.entity';
import { ProcessedEvent } from '../entities/processed-event.entity';
import { assertTransition } from '../domain/rental-status';

/**
 * Saga step 2 of 2: listens for PaymentCharged events and promotes the matching
 * rental from RESERVED → ACTIVE. Dedup + state update are in one transaction.
 */
@Injectable()
export class PaymentConfirmedConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentConfirmedConsumer.name);
  private consumer!: Consumer;

  constructor(
    private readonly kafka: KafkaService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    this.consumer = this.kafka.createConsumer('rental-service-payment');
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [TOPICS.PAYMENT_CHARGED],
      fromBeginning: true,
    });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        const event = await this.kafka.decode<EventEnvelope>(message.value);
        await this.handleEvent(event);
      },
    });
    this.logger.log('payment-confirmed consumer running');
  }

  async handleEvent(event: EventEnvelope): Promise<void> {
    if (event.eventType !== PAYMENT_CHARGED) return;
    const { payload } = event as PaymentChargedEvent;

    await this.dataSource.transaction(async (m) => {
      // Dedup + state update in one atomic transaction.
      const dedup = await m
        .createQueryBuilder()
        .insert()
        .into(ProcessedEvent)
        .values({ eventId: event.eventId, eventType: event.eventType })
        .orIgnore()
        .execute();
      if (dedup.raw.length === 0) {
        this.logger.debug(`skipping duplicate PaymentCharged ${event.eventId}`);
        return;
      }

      const rental = await m
        .createQueryBuilder(Rental, 'r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: payload.rentalId })
        .getOne();

      if (!rental) {
        this.logger.warn(`rental ${payload.rentalId} not found for PaymentCharged ${event.eventId}`);
        return;
      }
      if (rental.status !== 'RESERVED') {
        this.logger.debug(`rental ${payload.rentalId} already ${rental.status} — skipping`);
        return;
      }

      assertTransition(rental.status, 'ACTIVE');
      rental.status = 'ACTIVE';
      await m.save(rental);
      this.logger.debug(`rental ${payload.rentalId} confirmed ACTIVE`);
    });
  }

  async onModuleDestroy() {
    await this.consumer?.disconnect();
  }
}
