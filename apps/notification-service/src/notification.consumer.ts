import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer } from 'kafkajs';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from '@app/common';
import {
  BOOK_CREATED,
  BOOK_OVERDUE,
  BOOK_RENTED,
  BOOK_RETURNED,
  BookCreatedEvent,
  BookOverdueEvent,
  BookRentedEvent,
  BookReturnedEvent,
  EventEnvelope,
  TOPICS,
} from '@app/contracts';
import { ProcessedEvent } from './entities/processed-event.entity';
import { BookDetails, EmailService } from './email.service';

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

  private readonly authServiceUrl: string;
  private readonly catalogServiceUrl: string;

  constructor(
    private readonly kafka: KafkaService,
    private readonly email: EmailService,
    @InjectDataSource() private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.authServiceUrl = config.get('AUTH_SERVICE_URL', 'http://auth-service:3001');
    this.catalogServiceUrl = config.get('CATALOG_SERVICE_URL', 'http://catalog-service:3004');
  }

  async onModuleInit() {
    this.consumer = this.kafka.createConsumer('notification-service');
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [TOPICS.BOOK_CREATED, TOPICS.BOOK_RENTED, TOPICS.BOOK_RETURNED, TOPICS.BOOK_OVERDUE],
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
      if (event.eventType === BOOK_CREATED) {
        const { payload } = event as BookCreatedEvent;
        const emails = await this.fetchAllMemberEmails();
        await Promise.allSettled(
          emails.map((to) => this.email.sendNewBookAvailable(to, payload.title, payload.author)),
        );
        this.logger.debug(`sent new-book notifications for "${payload.title}" to ${emails.length} users`);
      } else if (event.eventType === BOOK_RENTED) {
        const { payload } = event as BookRentedEvent;
        const [to, book] = await Promise.all([
          this.fetchUserEmail(payload.userId),
          this.fetchBookDetails(payload.bookId),
        ]);
        if (to) {
          await this.email.sendBookRented(to, book, payload.dueAt);
          this.logger.debug(`sent rent confirmation for rental ${payload.rentalId}`);
        }
      } else if (event.eventType === BOOK_RETURNED) {
        const { payload } = event as BookReturnedEvent;
        const [to, book] = await Promise.all([
          this.fetchUserEmail(payload.userId),
          this.fetchBookDetails(payload.bookId),
        ]);
        if (to) {
          await this.email.sendBookReturned(to, book, payload.returnedAt);
          this.logger.debug(`sent return confirmation for rental ${payload.rentalId}`);
        }
      } else if (event.eventType === BOOK_OVERDUE) {
        const { payload } = event as BookOverdueEvent;
        const [to, book] = await Promise.all([
          this.fetchUserEmail(payload.userId),
          this.fetchBookDetails(payload.bookId),
        ]);
        if (to) {
          await this.email.sendBookOverdue(to, book, payload.dueAt);
          this.logger.debug(`sent overdue notice for rental ${payload.rentalId}`);
        }
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

  private async fetchBookDetails(bookId: string): Promise<BookDetails> {
    try {
      const res = await fetch(`${this.catalogServiceUrl}/internal/books/${bookId}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const b = (await res.json()) as {
        title: string;
        author: string;
        genre?: string | null;
        publishedYear?: number | null;
      };
      return { title: b.title, author: b.author, genre: b.genre ?? undefined, publishedYear: b.publishedYear ?? undefined };
    } catch (err) {
      this.logger.warn(`could not fetch book details for ${bookId}: ${(err as Error).message}`);
      return { title: bookId, author: '' };
    }
  }

  private async fetchUserEmail(userId: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.authServiceUrl}/internal/users/${userId}/email`);
      if (!res.ok) return null;
      const body = (await res.json()) as { email: string };
      return body.email;
    } catch (err) {
      this.logger.error(`failed to fetch email for user ${userId}: ${(err as Error).message}`);
      return null;
    }
  }

  private async fetchAllMemberEmails(): Promise<string[]> {
    try {
      const res = await fetch(`${this.authServiceUrl}/internal/users/emails`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      return (await res.json()) as string[];
    } catch (err) {
      this.logger.error(`failed to fetch member emails: ${(err as Error).message}`);
      return [];
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
