import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { CatalogService } from './catalog.service';

/**
 * Internal-only endpoints for service-to-service calls.
 * Not exposed through the API gateway — no auth guard, Docker-internal network only.
 */
@Controller('internal')
export class InternalCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('books/:id')
  async getBook(@Param('id', ParseUUIDPipe) id: string) {
    const book = await this.catalog.getBook(id).catch(() => null);
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }
}
