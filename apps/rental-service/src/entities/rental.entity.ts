import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { RentalStatus } from '../domain/rental-status';

@Entity({ name: 'rentals' })
@Index(['userId', 'status'])
export class Rental {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'book_id', type: 'uuid' })
  bookId!: string;

  /** The reservation claimed in inventory-service; also the Redis/idempotency key. */
  @Column({ name: 'reservation_id', type: 'uuid' })
  reservationId!: string;

  @Column({ type: 'text', default: 'ACTIVE' })
  status!: RentalStatus;

  @Column({ name: 'due_at', type: 'timestamptz' })
  dueAt!: Date;

  @CreateDateColumn({ name: 'rented_at', type: 'timestamptz' })
  rentedAt!: Date;

  @Column({ name: 'returned_at', type: 'timestamptz', nullable: true })
  returnedAt!: Date | null;
}
