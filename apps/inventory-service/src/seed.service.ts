import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from './entities/book.entity';

/**
 * Seeds a handful of books on first boot (dev only) so the catalog isn't empty
 * before catalog-service exists. Includes a single-copy title to exercise the
 * last-copy path by hand.
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Book) private readonly books: Repository<Book>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    if (this.config.get('NODE_ENV') === 'production') return;
    if ((await this.books.count()) > 0) return;

    const seed = [
      { title: 'The Pragmatic Programmer', author: 'Hunt & Thomas', totalCopies: 3 },
      { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', totalCopies: 2 },
      { title: 'The Last Copy', author: 'A. Scarce', totalCopies: 1 },
    ];
    await this.books.save(
      seed.map((b) => this.books.create({ ...b, availableCopies: b.totalCopies })),
    );
    this.logger.log(`seeded ${seed.length} books`);
  }
}
