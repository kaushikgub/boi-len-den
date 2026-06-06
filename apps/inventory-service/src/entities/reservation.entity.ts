import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

export type ReservationStatus = 'HELD' | 'CONFIRMED' | 'RELEASED' | 'RETURNED';

/**
 * A hold on one copy of a book. Created (HELD) by the synchronous reserve call
 * from rental-service, which also decrements the book's available count in the
 * same transaction. Lifecycle:
 *   HELD ──confirm(BookRented)──▶ CONFIRMED ──return(BookReturned)──▶ RETURNED
 *   HELD ──release / sweep────────▶ RELEASED  (count incremented back)
 *
 * The PK is the reservationId supplied by rental-service, which makes reserve
 * idempotent: a retried reserve with the same id is a no-op.
 */
@Entity({ name: 'reservations' })
export class Reservation {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'book_id', type: 'uuid' })
  bookId!: string;

  /** Set when the BookRented event confirms the hold; lets BookReturned find it. */
  @Index()
  @Column({ name: 'rental_id', type: 'uuid', nullable: true })
  rentalId!: string | null;

  @Column({ name: 'status', type: 'text', default: 'HELD' })
  status!: ReservationStatus;

  /** Abandoned HELD reservations past this time are released by the sweeper. */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
