import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Internal-only endpoints for service-to-service calls.
 * Not exposed through the API gateway — reachable only within the Docker network.
 */
@Controller('internal')
export class InternalController {
  constructor(private readonly users: UsersService) {}

  @Get('users/emails')
  getMemberEmails(): Promise<string[]> {
    return this.users.findAllMemberEmails();
  }

  @Get('users/:id/email')
  async getUserEmail(@Param('id', ParseUUIDPipe) id: string): Promise<{ email: string }> {
    const email = await this.users.findEmailById(id);
    if (!email) throw new NotFoundException('User not found');
    return { email };
  }
}
