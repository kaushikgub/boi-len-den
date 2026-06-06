import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '@app/common';
import { PaymentService } from './payment.service';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.payments.getPaymentsForUser(user.userId);
  }
}
