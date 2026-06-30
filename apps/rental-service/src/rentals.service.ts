import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { RedisService } from '@app/common';
import {
  BOOK_RENTED,
  BOOK_RETURNED,
  EventEnvelope,
  TOPICS,
} from '@app/contracts';
import { Rental } from './entities/rental.entity';
import { OutboxMessage } from './entities/outbox.entity';
import { InventoryClient } from './inventory.client';
import { CatalogClient } from './catalog.client';
import { buildEnvelope } from './outbox/envelope.factory';
import { assertTransition, isOutstanding } from './domain/rental-status';

@Injectable()
export class RentalsService {
  private readonly logger = new Logger(RentalsService.name);
  private readonly periodMs: number;
  private readonly lockTtlSec: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly inventory: InventoryClient,
    private readonly catalog: CatalogClient,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.periodMs = Number(config.get('RENTAL_PERIOD_DAYS', '14')) * 24 * 60 * 60 * 1000;
    this.lockTtlSec = Number(config.get('RENT_LOCK_TTL_SECONDS', '10'));
  }

  private static readonly TAB_STATUSES = {
    active: ['RESERVED', 'ACTIVE', 'OVERDUE'] as const,
    returned: ['RETURNED', 'CANCELLED'] as const,
  };

  async listForUser(
    userId: string,
    tab: 'active' | 'returned',
    page: number,
    limit: number,
  ) {
    const statuses = RentalsService.TAB_STATUSES[tab];
    const [rentals, total] = await this.dataSource.getRepository(Rental).findAndCount({
      where: { userId, status: In([...statuses]) },
      order: { rentedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = await Promise.all(
      rentals.map(async (rental) => {
        const book = await this.catalog.getBook(rental.bookId);
        return { ...rental, bookTitle: book?.title ?? null, bookCoverUrl: book?.coverUrl ?? null };
      }),
    );

    return { data, total, page, limit };
  }

  /**
   * Rent a book. Order matters for correctness under failure:
   *  1. Redis SET NX — fast optimistic gate, stops the same user double-submitting
   *     the same book concurrently. NOT the authoritative guard.
   *  2. Synchronous inventory.reserve — the authoritative atomic claim (409 = none).
   *  3. One DB transaction: write the ACTIVE rental AND the BookRented outbox row.
   *     If this commit fails after the reserve succeeded, release the hold
   *     (the inventory sweeper is the backstop).
   * The relay publishes the outbox row to Kafka afterwards (never "commit then
   * publish" — the event is durable the moment the rental commits).
   */
  async rent(userId: string, bookId: string, correlationId: string): Promise<Rental> {
    const reservationId = randomUUID();
    const lockKey = `rent-lock:${userId}:${bookId}`;
    const acquired = await this.redis.client.set(
      lockKey,
      reservationId,
      'EX',
      this.lockTtlSec,
      'NX',
    );
    if (!acquired) {
      throw new ConflictException('A rental for this book is already in progress');
    }

    try {
      await this.inventory.reserve(bookId, reservationId, correlationId);
      try {
        return await this.dataSource.transaction((m) =>
          this.commitRental(m, userId, bookId, reservationId, correlationId),
        );
      } catch (dbErr) {
        // Reserve succeeded but we couldn't record the rental — give the copy back.
        await this.inventory.release(reservationId, correlationId);
        throw dbErr;
      }
    } finally {
      await this.redis.client.del(lockKey);
    }
  }

  private async commitRental(
    m: EntityManager,
    userId: string,
    bookId: string,
    reservationId: string,
    correlationId: string,
  ): Promise<Rental> {
    const dueAt = new Date(Date.now() + this.periodMs);
    const rental = await m.save(
      m.create(Rental, { userId, bookId, reservationId, status: 'RESERVED', dueAt }),
    );
    const event = buildEnvelope(BOOK_RENTED, 1, bookId, correlationId, {
      rentalId: rental.id,
      reservationId,
      bookId,
      userId,
      dueAt: dueAt.toISOString(),
    });
    await this.appendOutbox(m, event.eventId, BOOK_RENTED, TOPICS.BOOK_RENTED, 'book-rented-value', bookId, event);
    return rental;
  }

  /** Return a rented book. Idempotent: returning an already-RETURNED rental is a no-op. */
  async returnBook(userId: string, rentalId: string, correlationId: string): Promise<Rental> {
    return this.dataSource.transaction(async (m) => {
      const rental = await m
        .createQueryBuilder(Rental, 'r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: rentalId })
        .getOne();
      if (!rental) throw new NotFoundException('Rental not found');
      if (rental.userId !== userId) throw new ForbiddenException('Not your rental');
      if (rental.status === 'RETURNED') return rental; // idempotent
      if (!isOutstanding(rental.status)) {
        throw new ConflictException(`Cannot return a ${rental.status} rental`);
      }

      const returnedAt = new Date();
      const wasOverdue = returnedAt > rental.dueAt;
      assertTransition(rental.status, 'RETURNED');
      rental.status = 'RETURNED';
      rental.returnedAt = returnedAt;
      await m.save(rental);

      const event = buildEnvelope(BOOK_RETURNED, 1, rental.bookId, correlationId, {
        rentalId: rental.id,
        bookId: rental.bookId,
        userId,
        returnedAt: returnedAt.toISOString(),
        wasOverdue,
      });
      await this.appendOutbox(
        m,
        event.eventId,
        BOOK_RETURNED,
        TOPICS.BOOK_RETURNED,
        'book-returned-value',
        rental.bookId,
        event,
      );
      return rental;
    });
  }

  private appendOutbox(
    m: EntityManager,
    eventId: string,
    eventType: string,
    topic: string,
    subject: string,
    messageKey: string,
    payload: EventEnvelope,
  ): Promise<unknown> {
    // jsonb column: TypeORM's deep-partial typing can't model an arbitrary event
    // payload (its `unknown` field), so cast at this serialization boundary only.
    const values = { eventId, eventType, topic, subject, messageKey, payload };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return m.insert(OutboxMessage, values as any);
  }
}
