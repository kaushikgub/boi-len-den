import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtAuthGuard, Roles, RolesGuard, CORRELATION_ID_HEADER } from '@app/common';
import { CatalogService } from './catalog.service';
import { CreateBookDto } from './dto';

@Controller('catalog/books')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list() {
    return this.catalog.listBooks();
  }

  @Get('search')
  search(@Query('q') q = '') {
    return this.catalog.searchBooks(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getBook(id);
  }

  @Post()
  @Roles('librarian', 'admin')
  create(
    @Body() dto: CreateBookDto,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    return this.catalog.createBook(dto, correlationId ?? randomUUID());
  }
}
