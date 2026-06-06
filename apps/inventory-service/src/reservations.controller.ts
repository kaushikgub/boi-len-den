import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { ReserveDto } from './dto';

/**
 * Internal service-to-service endpoints used by rental-service to claim and free
 * copies synchronously. NOT exposed through the gateway. (Slice 1 trusts the
 * internal network; production should add service-to-service auth / mTLS.)
 */
@Controller('inventory/reservations')
export class ReservationsController {
  constructor(private readonly inventory: InventoryService) {}

  /** Reserve a copy. 201 on success, 409 if sold out, 404 if no such book. */
  @Post()
  reserve(@Body() dto: ReserveDto) {
    return this.inventory.reserve(dto.bookId, dto.reservationId);
  }

  /** Release a hold (e.g. rental could not commit). Idempotent. */
  @Post(':id/release')
  @HttpCode(204)
  async release(@Param('id', ParseUUIDPipe) id: string) {
    await this.inventory.release(id);
  }
}
