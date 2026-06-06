import { ConfigService } from '@nestjs/config';
import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { Book } from '../src/entities/book.entity';
import { Reservation } from '../src/entities/reservation.entity';
import { ProcessedEvent } from '../src/entities/processed-event.entity';
import { InventoryService } from '../src/inventory.service';

/**
 * THE milestone test: the inventory DB is the source of truth for availability,
 * and its atomic conditional decrement must let exactly one renter win the last
 * copy no matter how many fire at once. This exercises the real Postgres row
 * lock — the mechanism that prevents oversell — against the live database.
 *
 * Requires `pnpm infra:up`. Run with `pnpm test:int`.
 */
const url =
  process.env.INVENTORY_DATABASE_URL ?? 'postgres://inventory:inventory@localhost:5435/inventory';

describe('last-copy race (integration — requires Postgres)', () => {
  let ds: DataSource;
  let inventory: InventoryService;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'postgres',
      url,
      entities: [Book, Reservation, ProcessedEvent],
      synchronize: true,
    });
    await ds.initialize();
    inventory = new InventoryService(ds, new ConfigService({ RESERVATION_TTL_SECONDS: '60' }));
  });

  afterAll(async () => {
    await ds?.destroy();
  });

  it('lets exactly ONE of N concurrent reservers claim the single copy', async () => {
    const repo = ds.getRepository(Book);
    const book = await repo.save(
      repo.create({
        title: `Race subject ${randomUUID()}`,
        author: 'test',
        totalCopies: 1,
        availableCopies: 1,
      }),
    );

    const N = 50;
    const results = await Promise.allSettled(
      Array.from({ length: N }, () => inventory.reserve(book.id, randomUUID())),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const soldOut = results.filter(
      (r) => r.status === 'rejected' && r.reason instanceof ConflictException,
    ).length;

    // Exactly one winner; everyone else gets a clean 409 — no oversell.
    expect(succeeded).toBe(1);
    expect(soldOut).toBe(N - 1);

    const after = await repo.findOneByOrFail({ id: book.id });
    expect(after.availableCopies).toBe(0); // decremented exactly once, never negative

    const held = await ds
      .getRepository(Reservation)
      .countBy({ bookId: book.id, status: 'HELD' });
    expect(held).toBe(1);
  });

  it('is idempotent: re-reserving with the same reservationId never double-decrements', async () => {
    const repo = ds.getRepository(Book);
    const book = await repo.save(
      repo.create({
        title: `Idempotent subject ${randomUUID()}`,
        author: 'test',
        totalCopies: 5,
        availableCopies: 5,
      }),
    );
    const reservationId = randomUUID();

    // Same reservation id fired 10× concurrently → one logical hold, one decrement.
    await Promise.all(Array.from({ length: 10 }, () => inventory.reserve(book.id, reservationId)));

    const after = await repo.findOneByOrFail({ id: book.id });
    expect(after.availableCopies).toBe(4);
  });
});
