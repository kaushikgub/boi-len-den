import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CORRELATION_ID_HEADER } from '@app/common';

/**
 * Synchronous client for inventory-service's internal reservation API. This call
 * is the authoritative last-copy guard: a 409 here means no copy was available,
 * so the rental is refused before any state is written.
 */
@Injectable()
export class InventoryClient {
  private readonly logger = new Logger(InventoryClient.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get('INVENTORY_SERVICE_URL', 'http://localhost:3003');
  }

  async reserve(bookId: string, reservationId: string, correlationId: string): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/inventory/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [CORRELATION_ID_HEADER]: correlationId },
        body: JSON.stringify({ bookId, reservationId }),
      });
    } catch (err) {
      throw new ServiceUnavailableException(`inventory unreachable: ${(err as Error).message}`);
    }
    if (res.ok) return;
    if (res.status === 409) throw new ConflictException('No copies available');
    if (res.status === 404) throw new NotFoundException('Book not found');
    throw new ServiceUnavailableException(`inventory reserve failed (${res.status})`);
  }

  /** Best-effort release; the inventory sweeper is the backstop if this fails. */
  async release(reservationId: string, correlationId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/inventory/reservations/${reservationId}/release`, {
        method: 'POST',
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      });
    } catch (err) {
      this.logger.error(`failed to release reservation ${reservationId}: ${(err as Error).message}`);
    }
  }
}
