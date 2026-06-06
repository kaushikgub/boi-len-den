import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { BOOK_CREATED, BookCreatedPayload, TOPICS } from '@app/contracts';
import { Book } from './entities/book.entity';
import { OutboxMessage } from './entities/outbox.entity';
import { buildEnvelope } from './outbox/envelope.factory';
import { CreateBookDto } from './dto';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  listBooks(): Promise<Book[]> {
    return this.dataSource.getRepository(Book).find({ order: { title: 'ASC' } });
  }

  async getBook(id: string): Promise<Book> {
    const book = await this.dataSource.getRepository(Book).findOne({ where: { id } });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  async searchBooks(q: string): Promise<Book[]> {
    if (!q.trim()) return this.listBooks();
    // Simple ILIKE search for Slice 2; Step 5 upgrades this to pg_tsvector FTS.
    const term = `%${q.trim()}%`;
    return this.dataSource
      .getRepository(Book)
      .createQueryBuilder('b')
      .where('b.title ILIKE :term OR b.author ILIKE :term', { term })
      .orderBy('b.title', 'ASC')
      .getMany();
  }

  async createBook(dto: CreateBookDto, correlationId: string): Promise<Book> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Book);
      const book = await repo.save(
        repo.create({
          title: dto.title,
          author: dto.author,
          isbn: dto.isbn ?? null,
          description: dto.description ?? null,
          genre: dto.genre ?? null,
          coverUrl: dto.coverUrl ?? null,
          publishedYear: dto.publishedYear ?? null,
        }),
      );
      await this.appendOutbox(manager, book, dto.totalCopies, correlationId);
      this.logger.log(`created book ${book.id} "${book.title}" (${dto.totalCopies} copies)`);
      return book;
    });
  }

  private async appendOutbox(
    manager: EntityManager,
    book: Book,
    totalCopies: number,
    correlationId: string,
  ): Promise<void> {
    const payload: BookCreatedPayload = {
      bookId: book.id,
      title: book.title,
      author: book.author,
      totalCopies,
    };
    const envelope = buildEnvelope(BOOK_CREATED, 1, book.id, correlationId, payload);
    const outboxRepo = manager.getRepository(OutboxMessage);
    await outboxRepo.save(
      outboxRepo.create({
        eventId: envelope.eventId,
        eventType: BOOK_CREATED,
        topic: TOPICS.BOOK_CREATED,
        subject: 'book-created-value',
        messageKey: book.id,
        payload: envelope as any, // TypeORM jsonb deep-partial typing
      }),
    );
  }
}
