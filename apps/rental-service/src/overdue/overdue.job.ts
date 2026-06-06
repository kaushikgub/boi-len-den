import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, LessThan } from 'typeorm';
import { BOOK_OVERDUE, TOPICS } from '@app/contracts';
import { Rental } from '../entities/rental.entity';
import { OutboxMessage } from '../entities/outbox.entity';
import { buildEnvelope } from '../outbox/envelope.factory';

/**
 * Hourly cron that finds ACTIVE rentals whose dueAt has passed and transitions
 * them to OVERDUE in the same DB transaction as the BookOverdue outbox row.
 * This ensures the event is never lost on a crash.
 */
@Injectable()
export class OverdueJob {
  private readonly logger = new Logger(OverdueJob.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runOverdueCheck(): Promise<void> {
    await this.markOverdue();
  }

  /** Public so integration tests can drive it deterministically. */
  async markOverdue(): Promise<number> {
    const now = new Date();
    const overdueRentals = await this.dataSource.getRepository(Rental).find({
      where: { status: 'ACTIVE', dueAt: LessThan(now) },
    });

    if (overdueRentals.length === 0) return 0;

    let marked = 0;
    for (const rental of overdueRentals) {
      try {
        await this.dataSource.transaction((m) => this.markOne(m, rental, now));
        marked += 1;
      } catch (err) {
        this.logger.error(`failed to mark rental ${rental.id} overdue: ${(err as Error).message}`);
      }
    }

    if (marked > 0) this.logger.log(`marked ${marked} rental(s) as OVERDUE`);
    return marked;
  }

  private async markOne(m: EntityManager, rental: Rental, now: Date): Promise<void> {
    // Re-read under pessimistic lock to avoid concurrent double-marking.
    const locked = await m
      .createQueryBuilder(Rental, 'r')
      .setLock('pessimistic_write')
      .where('r.id = :id AND r.status = :status', { id: rental.id, status: 'ACTIVE' })
      .getOne();

    if (!locked) return; // already transitioned by another process

    locked.status = 'OVERDUE';
    await m.save(locked);

    const event = buildEnvelope(BOOK_OVERDUE, 1, locked.bookId, 'system', {
      rentalId: locked.id,
      bookId: locked.bookId,
      userId: locked.userId,
      dueAt: locked.dueAt.toISOString(),
    });

    const values = {
      eventId: event.eventId,
      eventType: BOOK_OVERDUE,
      topic: TOPICS.BOOK_OVERDUE,
      subject: 'book-overdue-value',
      messageKey: locked.bookId,
      payload: event,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await m.insert(OutboxMessage, values as any);
  }
}
