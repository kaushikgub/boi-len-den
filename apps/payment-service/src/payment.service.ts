import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { PAYMENT_CHARGED, PAYMENT_REFUNDED, TOPICS } from '@app/contracts';
import { Payment } from './entities/payment.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { OutboxMessage } from './entities/outbox.entity';
import { buildEnvelope } from './outbox/envelope.factory';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly amountCents: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.amountCents = Number(config.get('CHARGE_AMOUNT_CENTS', '500'));
  }

  /**
   * Process a mock charge for a new rental. Idempotent: the BookRented eventId is
   * deduplicated via processed_events, and the Payment table has a rental_id UNIQUE
   * constraint as a belt-and-suspenders guard.
   *
   * All three writes (dedup row, payment row, outbox row) are in one transaction so
   * a crash between any of them leaves nothing half-written.
   */
  async processCharge(
    bookRentedEventId: string,
    rentalId: string,
    bookId: string,
    userId: string,
    correlationId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      if (!(await this.markProcessed(m, bookRentedEventId, 'BookRented'))) return;

      const payment = await m.save(
        m.create(Payment, {
          rentalId,
          bookId,
          userId,
          amountCents: this.amountCents,
          status: 'CHARGED',
        }),
      );

      await this.appendOutbox(m, buildEnvelope(PAYMENT_CHARGED, 1, rentalId, correlationId, {
        paymentId: payment.id,
        rentalId,
        bookId,
        userId,
        amountCents: this.amountCents,
        chargedAt: payment.chargedAt.toISOString(),
      }), TOPICS.PAYMENT_CHARGED, 'payment-charged-value', rentalId);

      this.logger.debug(`charged rental ${rentalId}: ${this.amountCents} cents`);
    });
  }

  /**
   * Process a mock refund when a rental is returned. Idempotent via processed_events
   * on the BookReturned eventId.
   */
  async processRefund(
    bookReturnedEventId: string,
    rentalId: string,
    bookId: string,
    userId: string,
    correlationId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      if (!(await this.markProcessed(m, bookReturnedEventId, 'BookReturned'))) return;

      const payment = await m.findOne(Payment, {
        where: { rentalId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) {
        this.logger.warn(`no payment found for rental ${rentalId} on return — skipping refund`);
        return;
      }
      if (payment.status === 'REFUNDED') return;

      payment.status = 'REFUNDED';
      payment.refundedAt = new Date();
      await m.save(payment);

      await this.appendOutbox(m, buildEnvelope(PAYMENT_REFUNDED, 1, rentalId, correlationId, {
        paymentId: payment.id,
        rentalId,
        bookId,
        userId,
        amountCents: payment.amountCents,
        refundedAt: payment.refundedAt.toISOString(),
      }), TOPICS.PAYMENT_REFUNDED, 'payment-refunded-value', rentalId);

      this.logger.debug(`refunded rental ${rentalId}: ${payment.amountCents} cents`);
    });
  }

  async getPaymentsForUser(
    userId: string,
    status: 'CHARGED' | 'REFUNDED' | undefined,
    page: number,
    limit: number,
  ): Promise<{ data: Payment[]; total: number; page: number; limit: number }> {
    const where = status ? { userId, status: In([status]) } : { userId };
    const [data, total] = await this.dataSource.getRepository(Payment).findAndCount({
      where,
      order: { chargedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  private async markProcessed(m: EntityManager, eventId: string, eventType: string): Promise<boolean> {
    const result = await m
      .createQueryBuilder()
      .insert()
      .into(ProcessedEvent)
      .values({ eventId, eventType })
      .orIgnore()
      .execute();
    return result.raw.length > 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private appendOutbox(m: EntityManager, payload: any, topic: string, subject: string, messageKey: string) {
    return m.insert(OutboxMessage, {
      eventId: payload.eventId,
      eventType: payload.eventType,
      topic,
      subject,
      messageKey,
      payload,
    } as any);
  }
}
