import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'books' })
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  author!: string;

  @Column({ type: 'text', nullable: true })
  isbn!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  genre!: string | null;

  @Column({ name: 'cover_url', type: 'text', nullable: true })
  coverUrl!: string | null;

  @Column({ name: 'published_year', type: 'int', nullable: true })
  publishedYear!: number | null;

  /** How many physical copies the library owns. Set at creation; never decremented here. */
  @Column({ name: 'total_copies', type: 'int' })
  totalCopies!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
