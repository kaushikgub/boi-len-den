import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '@app/common';
import { PaymentService } from './payment.service';
import { ListPaymentsQueryDto } from './dto';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListPaymentsQueryDto) {
    return this.payments.getPaymentsForUser(user.userId, query.status, query.page, query.limit);
  }
}
