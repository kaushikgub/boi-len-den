import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { RedisService } from '@app/common';
import { BOOK_CREATED, BookCreatedPayload, TOPICS } from '@app/contracts';
import { Book } from './entities/book.entity';
import { OutboxMessage } from './entities/outbox.entity';
import { buildEnvelope } from './outbox/envelope.factory';
import { CreateBookDto } from './dto';

const LIST_KEY = 'catalog:books:list';
const bookKey = (id: string) => `catalog:book:${id}`;
const LIST_TTL = 60;   // seconds
const BOOK_TTL = 300;  // seconds

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  async listBooks(): Promise<Book[]> {
    const cached = await this.redis.client.get(LIST_KEY);
    if (cached) return JSON.parse(cached) as Book[];
    const books = await this.dataSource.getRepository(Book).find({ order: { title: 'ASC' } });
    await this.redis.client.setex(LIST_KEY, LIST_TTL, JSON.stringify(books));
    return books;
  }

  async getBook(id: string): Promise<Book> {
    const cached = await this.redis.client.get(bookKey(id));
    if (cached) return JSON.parse(cached) as Book;
    const book = await this.dataSource.getRepository(Book).findOne({ where: { id } });
    if (!book) throw new NotFoundException('Book not found');
    await this.redis.client.setex(bookKey(id), BOOK_TTL, JSON.stringify(book));
    return book;
  }

  async searchBooks(q: string): Promise<Book[]> {
    if (!q.trim()) return this.listBooks();
    return this.dataSource
      .getRepository(Book)
      .createQueryBuilder('b')
      .where(`b.search_vector @@ plainto_tsquery('english', :q)`, { q: q.trim() })
      .orderBy(`ts_rank(b.search_vector, plainto_tsquery('english', :q))`, 'DESC')
      .setParameter('q', q.trim())
      .getMany();
  }

  async createBook(dto: CreateBookDto, correlationId: string): Promise<Book> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Book);
      const book = await repo.save(
        repo.create({
          title: dto.title,
          author: dto.author,
          totalCopies: dto.totalCopies,
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
    }).then(async (book) => {
      // Invalidate list cache after commit so the next read re-fetches from DB.
      await this.redis.client.del(LIST_KEY);
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
      ...(book.coverUrl ? { coverUrl: book.coverUrl } : {}),
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
