import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { Request } from 'express';
import { randomUUID } from 'crypto';
import { AuthenticatedUser, JwtAuthGuard, Roles, RolesGuard, CORRELATION_ID_HEADER } from '@app/common';
import { CatalogService } from './catalog.service';
import { CreateBookDto, UpdateBookDto } from './dto';

@Controller('catalog/books')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /**
   * Public: returns only visible books.
   * Admin/librarian: pass ?includeHidden=true to get all books including hidden ones.
   */
  @Get()
  list(@Query('includeHidden') includeHidden?: string, @Req() req?: Request) {
    if (includeHidden === 'true') {
      const user = (req as any)?.user as AuthenticatedUser | undefined;
      const isAdmin = user?.roles?.includes('librarian') || user?.roles?.includes('admin');
      if (!isAdmin) throw new ForbiddenException();
      return this.catalog.listAllBooks();
    }
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

  @Patch(':id')
  @Roles('librarian', 'admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookDto,
  ) {
    return this.catalog.updateBook(id, dto);
  }

  @Delete(':id')
  @Roles('librarian', 'admin')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.catalog.deleteBook(id);
  }
}
