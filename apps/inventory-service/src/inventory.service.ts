import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Book } from './entities/book.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { Reservation } from './entities/reservation.entity';

export interface ReserveResult {
  reservationId: string;
  bookId: string;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  private readonly ttlMs: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.ttlMs = Number(config.get('RESERVATION_TTL_SECONDS', '60')) * 1000;
  }

  listBooks(): Promise<Book[]> {
    return this.dataSource.getRepository(Book).find({ order: { title: 'ASC' } });
  }

  async getBook(id: string): Promise<Book> {
    const book = await this.dataSource.getRepository(Book).findOne({ where: { id } });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  async createBook(input: { title: string; author: string; totalCopies: number }): Promise<Book> {
    const repo = this.dataSource.getRepository(Book);
    return repo.save(
      repo.create({
        title: input.title,
        author: input.author,
        totalCopies: input.totalCopies,
        availableCopies: input.totalCopies,
      }),
    );
  }

  async deleteBook(id: string): Promise<void> {
    const repo = this.dataSource.getRepository(Book);
    const book = await repo.findOne({ where: { id } });
    if (!book) throw new NotFoundException('Book not found');
    await repo.delete({ id });
    this.logger.log(`deleted book ${id} "${book.title}" from inventory`);
  }

  /** Idempotent: ON CONFLICT (id) DO NOTHING. A redelivered BookCreated event is a no-op. */
  async createBookFromEvent(
    bookId: string,
    title: string,
    author: string,
    totalCopies: number,
    coverUrl?: string | null,
  ): Promise<void> {
    await this.dataSource
      .getRepository(Book)
      .createQueryBuilder()
      .insert()
      .into(Book)
      .values({ id: bookId, title, author, totalCopies, availableCopies: totalCopies, coverUrl: coverUrl ?? null })
      .orIgnore()
      .execute();
  }

  /**
   * Atomically reserve one copy. This is THE last-copy guard:
   *  1. Insert the reservation (ON CONFLICT DO NOTHING) → idempotent on retries.
   *  2. Only if newly inserted, conditionally decrement available_copies with a
   *     `WHERE available_copies > 0`. Postgres row-locks the book row, so under
   *     N concurrent reservers exactly `available_copies` succeed — never more.
   *  3. If no copy is free, throw, rolling back the reservation insert too.
   */
  async reserve(bookId: string, reservationId: string): Promise<ReserveResult> {
    return this.dataSource.transaction(async (manager) => {
      const insert = await manager
        .createQueryBuilder()
        .insert()
        .into(Reservation)
        .values({
          id: reservationId,
          bookId,
          status: 'HELD',
          expiresAt: new Date(Date.now() + this.ttlMs),
        })
        .orIgnore() // ON CONFLICT (id) DO NOTHING
        .execute();

      const newlyInserted = insert.raw.length > 0;
      if (!newlyInserted) {
        // Same reservationId already held — idempotent success, no second decrement.
        return { reservationId, bookId };
      }

      const dec = await manager
        .createQueryBuilder()
        .update(Book)
        .set({ availableCopies: () => 'available_copies - 1' })
        .where('id = :bookId AND available_copies > 0', { bookId })
        .execute();

      if (!dec.affected) {
        const exists = await manager.findOne(Book, { where: { id: bookId } });
        // Throwing rolls back the reservation insert above — no orphan hold.
        if (!exists) throw new NotFoundException('Book not found');
        throw new ConflictException('No copies available');
      }

      return { reservationId, bookId };
    });
  }

  /** Release a HELD reservation and return its copy. Idempotent (only HELD releases). */
  async release(reservationId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const res = await this.lockReservation(manager, reservationId);
      if (!res || res.status !== 'HELD') return;
      await manager.update(Reservation, { id: reservationId }, { status: 'RELEASED' });
      await this.incrementAvailable(manager, res.bookId);
    });
  }

  /** Confirm a HELD reservation once its BookRented event arrives. No count change. */
  async confirm(reservationId: string, rentalId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const res = await this.lockReservation(manager, reservationId);
      if (!res) {
        this.logger.warn(`confirm: reservation ${reservationId} not found`);
        return;
      }
      if (res.status !== 'HELD') {
        // Already confirmed (idempotent) or released by the sweeper before the
        // event arrived (drift — reconciliation territory).
        this.logger.warn(`confirm: reservation ${reservationId} is ${res.status}, not HELD`);
        return;
      }
      await manager.update(Reservation, { id: reservationId }, { status: 'CONFIRMED', rentalId });
    });
  }

  /**
   * Apply a BookReturned event: increment availability exactly once (deduped by
   * eventId) and mark the reservation RETURNED. The dedupe row and the increment
   * commit together, so a redelivered event is a no-op.
   */
  async applyReturn(eventId: string, bookId: string, rentalId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const dedupe = await manager
        .createQueryBuilder()
        .insert()
        .into(ProcessedEvent)
        .values({ eventId, eventType: 'BookReturned' })
        .orIgnore()
        .execute();
      if (dedupe.raw.length === 0) {
        this.logger.debug(`applyReturn: event ${eventId} already processed, skipping`);
        return;
      }
      await this.incrementAvailable(manager, bookId);
      await manager.update(Reservation, { rentalId }, { status: 'RETURNED' });
    });
  }

  /** Release HELD reservations whose hold expired before being confirmed. */
  async sweepExpired(): Promise<number> {
    const expired = await this.dataSource.getRepository(Reservation).find({
      where: { status: 'HELD' },
    });
    const now = Date.now();
    let released = 0;
    for (const r of expired) {
      if (r.expiresAt.getTime() <= now) {
        await this.release(r.id);
        released += 1;
      }
    }
    if (released > 0) this.logger.log(`sweep released ${released} expired hold(s)`);
    return released;
  }

  private lockReservation(manager: EntityManager, id: string): Promise<Reservation | null> {
    return manager
      .createQueryBuilder(Reservation, 'r')
      .setLock('pessimistic_write')
      .where('r.id = :id', { id })
      .getOne();
  }

  /** Increment availability without ever exceeding total_copies. */
  private async incrementAvailable(manager: EntityManager, bookId: string): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(Book)
      .set({ availableCopies: () => 'available_copies + 1' })
      .where('id = :bookId AND available_copies < total_copies', { bookId })
      .execute();
  }
}
