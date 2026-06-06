import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Inventory's view of a book. For Slice 1 it also carries minimal display
 * metadata (title/author) so the frontend can browse before catalog-service
 * exists; in Slice 2 catalog owns metadata and this keeps only the counts.
 *
 * `availableCopies` is the source of truth for availability. The last-copy race
 * is won here, by an atomic conditional decrement on this row.
 */
@Entity({ name: 'books' })
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  author!: string;

  @Column({ name: 'total_copies', type: 'int' })
  totalCopies!: number;

  @Column({ name: 'available_copies', type: 'int' })
  availableCopies!: number;

  @Column({ name: 'cover_url', type: 'text', nullable: true, default: null })
  coverUrl!: string | null;
}
