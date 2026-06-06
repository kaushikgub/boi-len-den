import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Ensures the GIN index on the books.search_vector column exists.
 * TypeORM's synchronize mode can't emit GIN DDL from a decorator, so we create
 * it once with CREATE INDEX IF NOT EXISTS on startup. CONCURRENTLY is omitted
 * (it can't run inside the implicit transaction that onModuleInit may use), and
 * the table is tiny in dev, so a regular CREATE is fine.
 */
@Injectable()
export class CatalogSetupService implements OnModuleInit {
  private readonly logger = new Logger(CatalogSetupService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_books_search_vector
      ON books USING GIN (search_vector)
    `);
    this.logger.log('GIN index on books.search_vector ensured');
  }
}
