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
import { InventoryService } from './inventory.service';

/**
 * Consumes the rental-lifecycle events. Both handlers are idempotent:
 *  - BookRented confirms the existing hold (no count change). The copy was
 *    already decremented synchronously at reserve time — this event is NOT the
 *    decrement trigger, just confirmation + fan-out.
 *  - BookReturned increments availability exactly once (deduped by eventId).
 */
@Injectable()
export class InventoryConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InventoryConsumer.name);
  private consumer!: Consumer;

  constructor(
    private readonly kafka: KafkaService,
    private readonly inventory: InventoryService,
  ) {}

  async onModuleInit() {
    this.consumer = this.kafka.createConsumer('inventory-service');
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
    this.logger.log('inventory consumer running');
  }

  /** Route a decoded event to the right idempotent handler. Public for testing. */
  async handleEvent(topic: string, event: EventEnvelope): Promise<void> {
    const log = `${event.eventType} eventId=${event.eventId} correlationId=${event.correlationId}`;
    if (event.eventType === BOOK_RENTED) {
      const { payload } = event as BookRentedEvent;
      await this.inventory.confirm(payload.reservationId, payload.rentalId);
      this.logger.debug(`confirmed reservation from ${log}`);
    } else if (event.eventType === BOOK_RETURNED) {
      const { payload } = event as BookReturnedEvent;
      await this.inventory.applyReturn(event.eventId, payload.bookId, payload.rentalId);
      this.logger.debug(`applied return from ${log}`);
    } else {
      this.logger.warn(`ignoring unexpected event on ${topic}: ${event.eventType}`);
    }
  }

  async onModuleDestroy() {
    await this.consumer?.disconnect();
  }
}
