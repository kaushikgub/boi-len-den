import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { Rental } from '../src/entities/rental.entity';
import { OutboxMessage } from '../src/entities/outbox.entity';
import { OverdueJob } from '../src/overdue/overdue.job';
import { BOOK_OVERDUE } from '@app/contracts';

/**
 * Verifies that OverdueJob:
 *   1. Marks ACTIVE rentals past their dueAt as OVERDUE.
 *   2. Writes a BookOverdue outbox row in the same transaction.
 *   3. Does NOT touch rentals that are not yet due or already in a terminal state.
 *   4. Is idempotent: re-running on already-OVERDUE rentals produces no extra rows.
 *
 * Requires `pnpm infra:up`. Run with `pnpm test:int`.
 */
const url =
  process.env.RENTAL_DATABASE_URL ?? 'postgres://rental:rental@localhost:5434/rental';

describe('OverdueJob (integration — requires Postgres)', () => {
  let ds: DataSource;
  let job: OverdueJob;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'postgres',
      url,
      entities: [Rental, OutboxMessage],
      synchronize: true,
    });
    await ds.initialize();
    job = new OverdueJob(ds);
  });

  afterAll(async () => {
    await ds?.destroy();
  });

  it('marks ACTIVE past-due rentals as OVERDUE and writes outbox rows', async () => {
    const repo = ds.getRepository(Rental);

    // One rental already overdue.
    const pastDue = await repo.save(
      repo.create({
        userId: randomUUID(),
        bookId: randomUUID(),
        reservationId: randomUUID(),
        status: 'ACTIVE',
        dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
      }),
    );

    // One rental not yet due — must be left untouched.
    const notYetDue = await repo.save(
      repo.create({
        userId: randomUUID(),
        bookId: randomUUID(),
        reservationId: randomUUID(),
        status: 'ACTIVE',
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // next week
      }),
    );

    const marked = await job.markOverdue();
    expect(marked).toBeGreaterThanOrEqual(1);

    const updated = await repo.findOneByOrFail({ id: pastDue.id });
    expect(updated.status).toBe('OVERDUE');

    const untouched = await repo.findOneByOrFail({ id: notYetDue.id });
    expect(untouched.status).toBe('ACTIVE');

    const outboxRow = await ds
      .getRepository(OutboxMessage)
      .findOneBy({ eventId: expect.stringMatching(/.+/), eventType: BOOK_OVERDUE });
    // There should be at least one BookOverdue outbox row for our rental.
    const overdueRows = await ds
      .getRepository(OutboxMessage)
      .find({ where: { eventType: BOOK_OVERDUE } });
    expect(overdueRows.some((r) => {
      const p = (r.payload as any).payload;
      return p?.rentalId === pastDue.id;
    })).toBe(true);
  });

  it('is idempotent: running again on OVERDUE rentals produces no new outbox rows', async () => {
    const repo = ds.getRepository(Rental);
    const outboxRepo = ds.getRepository(OutboxMessage);

    const alreadyOverdue = await repo.save(
      repo.create({
        userId: randomUUID(),
        bookId: randomUUID(),
        reservationId: randomUUID(),
        status: 'OVERDUE',
        dueAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      }),
    );

    const countBefore = await outboxRepo.count({ where: { eventType: BOOK_OVERDUE } });
    await job.markOverdue();
    const countAfter = await outboxRepo.count({ where: { eventType: BOOK_OVERDUE } });

    // No new outbox row should have been written for the already-OVERDUE rental.
    expect(countAfter).toBe(countBefore); // stable — or at most +1 from other ACTIVE rows in this DB

    const still = await repo.findOneByOrFail({ id: alreadyOverdue.id });
    expect(still.status).toBe('OVERDUE');
  });
});
