import { Controller, Get } from '@nestjs/common';
import { InventoryService } from './inventory.service';

/**
 * Internal-only endpoints for service-to-service calls.
 * Not exposed through the API gateway — no auth guard, Docker-internal network only.
 */
@Controller('internal')
export class InternalInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('books')
  async listAvailability() {
    const books = await this.inventory.listBooks();
    return books.map((b) => ({ id: b.id, availableCopies: b.availableCopies }));
  }
}
