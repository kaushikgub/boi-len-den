import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { ProcessedEvent } from '../src/entities/processed-event.entity';
import { NotificationConsumer } from '../src/notification.consumer';
import { EmailService } from '../src/email.service';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from '@app/common';
import { BOOK_RENTED, BOOK_OVERDUE, EventEnvelope } from '@app/contracts';

/**
 * Verifies that NotificationConsumer:
 *   1. Processes a new event and calls the email service.
 *   2. Skips a duplicate (redelivered) event — the dedup row prevents a second email.
 *
 * EmailService is replaced with a mock so we don't need an SMTP server.
 * Requires `pnpm infra:up`. Run with `pnpm test:int`.
 */
const url =
  process.env.NOTIFICATION_DATABASE_URL ??
  'postgres://notification:notification@localhost:5437/notification';

describe('NotificationConsumer dedup (integration — requires Postgres)', () => {
  let ds: DataSource;
  let consumer: NotificationConsumer;
  let emailMock: jest.Mocked<EmailService>;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'postgres',
      url,
      entities: [ProcessedEvent],
      synchronize: true,
    });
    await ds.initialize();

    emailMock = {
      sendBookRented: jest.fn().mockResolvedValue(undefined),
      sendBookReturned: jest.fn().mockResolvedValue(undefined),
      sendBookOverdue: jest.fn().mockResolvedValue(undefined),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    } as unknown as jest.Mocked<EmailService>;

    // KafkaService not needed for direct handleEvent tests.
    consumer = new NotificationConsumer(
      {} as unknown as KafkaService,
      emailMock,
      ds,
    );
  });

  afterAll(async () => {
    await ds?.destroy();
  });

  function makeEnvelope(eventType: string, payload: unknown): EventEnvelope {
    return {
      eventId: randomUUID(),
      eventType,
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      key: randomUUID(),
      correlationId: randomUUID(),
      payload,
    };
  }

  it('sends an email and records the event on first delivery', async () => {
    const event = makeEnvelope(BOOK_RENTED, {
      rentalId: randomUUID(),
      reservationId: randomUUID(),
      bookId: randomUUID(),
      userId: `user-${randomUUID()}@test.example`,
      dueAt: new Date(Date.now() + 14 * 86400 * 1000).toISOString(),
    });

    await consumer.handleEvent('book-rented', event);

    expect(emailMock.sendBookRented).toHaveBeenCalledTimes(1);

    const row = await ds.getRepository(ProcessedEvent).findOneBy({ eventId: event.eventId });
    expect(row).toBeTruthy();
    expect(row!.eventType).toBe(BOOK_RENTED);
  });

  it('skips the email on redelivery (duplicate eventId)', async () => {
    const event = makeEnvelope(BOOK_OVERDUE, {
      rentalId: randomUUID(),
      bookId: randomUUID(),
      userId: `user-${randomUUID()}@test.example`,
      dueAt: new Date(Date.now() - 86400 * 1000).toISOString(),
    });

    // First delivery.
    await consumer.handleEvent('book-overdue', event);
    expect(emailMock.sendBookOverdue).toHaveBeenCalledTimes(1);

    // Redelivery with the same eventId.
    await consumer.handleEvent('book-overdue', event);
    // Still called exactly once — no second email.
    expect(emailMock.sendBookOverdue).toHaveBeenCalledTimes(1);
  });
});
