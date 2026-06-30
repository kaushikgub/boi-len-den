import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Fetches availability counts from inventory-service's internal endpoint.
 * Returns a map of bookId → availableCopies. On any error returns an empty map
 * so a catalog list request never fails because inventory is down.
 */
@Injectable()
export class InventoryClient {
  private readonly logger = new Logger(InventoryClient.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get('INVENTORY_SERVICE_URL', 'http://localhost:3003');
  }

  async getAvailabilityMap(): Promise<Map<string, number>> {
    try {
      const res = await fetch(`${this.baseUrl}/internal/books`);
      if (!res.ok) return new Map();
      const data = (await res.json()) as { id: string; availableCopies: number }[];
      return new Map(data.map((b) => [b.id, b.availableCopies]));
    } catch (err) {
      this.logger.warn(`inventory availability fetch failed: ${(err as Error).message}`);
      return new Map();
    }
  }
}
