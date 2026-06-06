import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type PaymentStatus = 'CHARGED' | 'REFUNDED';

@Entity({ name: 'payments' })
@Unique(['rentalId'])
@Index(['userId'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** One payment per rental; the UNIQUE constraint enforces idempotency. */
  @Column({ name: 'rental_id', type: 'uuid' })
  rentalId!: string;

  @Column({ name: 'book_id', type: 'uuid' })
  bookId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /** Fixed rental fee in cents (e.g. 500 = $5.00). */
  @Column({ name: 'amount_cents', type: 'int' })
  amountCents!: number;

  @Column({ type: 'text' })
  status!: PaymentStatus;

  @CreateDateColumn({ name: 'charged_at', type: 'timestamptz' })
  chargedAt!: Date;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt!: Date | null;
}
