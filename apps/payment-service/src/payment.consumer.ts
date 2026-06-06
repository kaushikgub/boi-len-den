import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer } from 'kafkajs';
import { KafkaService } from '@app/common';
import {
  BOOK_RENTED,
  BOOK_RETURNED,
  BookRentedEvent,
  BookReturnedEvent,
  EventEnvelope,
  TOPICS,
} from '@app/contracts';
import { PaymentService } from './payment.service';

/**
 * Listens to book-rented and book-returned events and triggers mock charges/refunds.
 * Dedup + atomicity are handled inside PaymentService (processed_events in same tx).
 */
@Injectable()
export class PaymentConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentConsumer.name);
  private consumer!: Consumer;

  constructor(
    private readonly kafka: KafkaService,
    private readonly payments: PaymentService,
  ) {}

  async onModuleInit() {
    this.consumer = this.kafka.createConsumer('payment-service');
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [TOPICS.BOOK_RENTED, TOPICS.BOOK_RETURNED],
      fromBeginning: true,
    });
    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;
        const event = await this.kafka.decode<EventEnvelope>(message.value);
        await this.handleEvent(topic, event);
      },
    });
    this.logger.log('payment consumer running');
  }

  async handleEvent(topic: string, event: EventEnvelope): Promise<void> {
    try {
      if (event.eventType === BOOK_RENTED) {
        const { payload } = event as BookRentedEvent;
        await this.payments.processCharge(
          event.eventId,
          payload.rentalId,
          payload.bookId,
          payload.userId,
          event.correlationId,
        );
      } else if (event.eventType === BOOK_RETURNED) {
        const { payload } = event as BookReturnedEvent;
        await this.payments.processRefund(
          event.eventId,
          payload.rentalId,
          payload.bookId,
          payload.userId,
          event.correlationId,
        );
      } else {
        this.logger.warn(`ignoring unexpected event on ${topic}: ${event.eventType}`);
      }
    } catch (err) {
      this.logger.error(
        `payment processing failed for ${event.eventId} (${event.eventType}): ${(err as Error).message}`,
      );
      throw err; // let kafkajs retry
    }
  }

  async onModuleDestroy() {
    await this.consumer?.disconnect();
  }
}
