import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BookInfo {
  id: string;
  title: string;
  coverUrl: string | null;
}

/**
 * Thin HTTP client for catalog-service's internal book lookup.
 * Returns null on any error so a catalog outage never breaks the rental list.
 */
@Injectable()
export class CatalogClient {
  private readonly logger = new Logger(CatalogClient.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get('CATALOG_SERVICE_URL', 'http://localhost:3004');
  }

  async getBook(bookId: string): Promise<BookInfo | null> {
    try {
      const res = await fetch(`${this.baseUrl}/internal/books/${bookId}`);
      if (!res.ok) return null;
      const data = (await res.json()) as BookInfo;
      return { id: data.id, title: data.title, coverUrl: data.coverUrl ?? null };
    } catch (err) {
      this.logger.warn(`catalog lookup failed for book ${bookId}: ${(err as Error).message}`);
      return null;
    }
  }
}
