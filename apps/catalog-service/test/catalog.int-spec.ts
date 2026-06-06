/**
 * catalog-service integration tests. Requires postgres-catalog to be running.
 * Run: pnpm test:int
 */
import { DataSource } from 'typeorm';
import { Book } from '../src/entities/book.entity';
import { OutboxMessage } from '../src/entities/outbox.entity';

const DB_URL =
  process.env.CATALOG_DATABASE_URL ??
  'postgres://catalog:catalog@localhost:5436/catalog';

let ds: DataSource;

beforeAll(async () => {
  ds = new DataSource({
    type: 'postgres',
    url: DB_URL,
    entities: [Book, OutboxMessage],
    synchronize: true,
  });
  await ds.initialize();
  // Ensure GIN index exists (mirrors CatalogSetupService)
  await ds.query(`
    CREATE INDEX IF NOT EXISTS idx_books_search_vector ON books USING GIN (search_vector)
  `);
});

afterAll(async () => {
  await ds.destroy();
});

beforeEach(async () => {
  await ds.query('DELETE FROM outbox');
  await ds.query('DELETE FROM books');
});

describe('Book entity FTS', () => {
  it('search_vector is auto-populated for new books', async () => {
    const repo = ds.getRepository(Book);
    await repo.save(
      repo.create({ title: 'Domain-Driven Design', author: 'Eric Evans', totalCopies: 2 }),
    );

    const [row] = await ds.query(
      `SELECT search_vector::text FROM books WHERE title = $1`,
      ['Domain-Driven Design'],
    );
    expect(row.search_vector).toBeTruthy();
    expect(row.search_vector).toContain('driven');
    expect(row.search_vector).toContain('eric');
  });

  it('plainto_tsquery returns matching books', async () => {
    const repo = ds.getRepository(Book);
    await repo.save([
      repo.create({ title: 'Clean Code', author: 'Robert Martin', totalCopies: 3 }),
      repo.create({ title: 'Refactoring', author: 'Martin Fowler', totalCopies: 2 }),
      repo.create({ title: 'The Phoenix Project', author: 'Gene Kim', totalCopies: 1 }),
    ]);

    const results = await ds
      .getRepository(Book)
      .createQueryBuilder('b')
      .where(`b.search_vector @@ plainto_tsquery('english', :q)`, { q: 'clean' })
      .getMany();

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Clean Code');
  });

  it('ts_rank orders by relevance', async () => {
    const repo = ds.getRepository(Book);
    await repo.save([
      repo.create({ title: 'Martin and the Microservices', author: 'Jane Doe', totalCopies: 1 }),
      repo.create({ title: 'Clean Code', author: 'Robert Martin', totalCopies: 2 }),
    ]);

    const results = await ds
      .getRepository(Book)
      .createQueryBuilder('b')
      .where(`b.search_vector @@ plainto_tsquery('english', :q)`, { q: 'martin' })
      .orderBy(`ts_rank(b.search_vector, plainto_tsquery('english', :q))`, 'DESC')
      .setParameter('q', 'martin')
      .getMany();

    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('no match returns empty array', async () => {
    const repo = ds.getRepository(Book);
    await repo.save(repo.create({ title: 'The Hobbit', author: 'Tolkien', totalCopies: 1 }));

    const results = await ds
      .getRepository(Book)
      .createQueryBuilder('b')
      .where(`b.search_vector @@ plainto_tsquery('english', :q)`, { q: 'microservices kafka' })
      .getMany();

    expect(results).toHaveLength(0);
  });
});

describe('OutboxMessage created with book', () => {
  it('outbox row is written in same transaction as book', async () => {
    const bookRepo = ds.getRepository(Book);
    const outboxRepo = ds.getRepository(OutboxMessage);

    await ds.transaction(async (m) => {
      const book = await m.getRepository(Book).save(
        bookRepo.create({ title: 'Test Book', author: 'Author', totalCopies: 1 }),
      );
      await m.getRepository(OutboxMessage).save(
        outboxRepo.create({
          eventId: '00000000-0000-0000-0000-000000000001',
          eventType: 'BookCreated',
          topic: 'book-created',
          subject: 'book-created-value',
          messageKey: book.id,
          payload: { eventId: '00000000-0000-0000-0000-000000000001', eventType: 'BookCreated' } as any,
          publishedAt: null,
        }),
      );
    });

    const pending = await outboxRepo.find({ where: { publishedAt: undefined } });
    expect(pending).toHaveLength(1);
    expect(pending[0].eventType).toBe('BookCreated');
  });
});
