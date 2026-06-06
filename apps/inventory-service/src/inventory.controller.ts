import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '@app/common';
import { InventoryService } from './inventory.service';
import { CreateBookDto } from './dto';

/**
 * Public-facing book endpoints (reached through the gateway). Guarded again here
 * with JwtAuthGuard — the service never trusts the network alone. Creating books
 * is restricted to librarians/admins.
 */
@Controller('inventory/books')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list() {
    return this.inventory.listBooks();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventory.getBook(id);
  }

  @Post()
  @Roles('librarian', 'admin')
  create(@Body() dto: CreateBookDto) {
    return this.inventory.createBook(dto);
  }

  @Delete(':id')
  @Roles('librarian', 'admin')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.inventory.deleteBook(id);
  }
}
