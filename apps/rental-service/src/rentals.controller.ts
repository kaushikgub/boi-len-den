import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AuthenticatedUser,
  CORRELATION_ID_HEADER,
  CurrentUser,
  JwtAuthGuard,
} from '@app/common';
import { RentalsService } from './rentals.service';
import { ListRentalsQueryDto, RentBookDto } from './dto';

@Controller('rentals')
@UseGuards(JwtAuthGuard)
export class RentalsController {
  constructor(private readonly rentals: RentalsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListRentalsQueryDto) {
    return this.rentals.listForUser(user.userId, query.tab, query.page, query.limit);
  }

  @Post()
  rent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RentBookDto,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    return this.rentals.rent(user.userId, dto.bookId, correlationId ?? randomUUID());
  }

  @Post(':id/return')
  @HttpCode(200)
  returnBook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    return this.rentals.returnBook(user.userId, id, correlationId ?? randomUUID());
  }
}
