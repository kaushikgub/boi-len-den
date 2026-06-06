import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { JwtValidatorService } from './jwt-validator.service';
import { AuthenticatedUser } from './authenticated-user';

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

/**
 * Re-validates the forwarded access token inside a downstream service (defense in
 * depth). The gateway already validated it, but services never trust the network
 * alone — a token that reaches a service directly is still verified here.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly validator: JwtValidatorService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    req.user = await this.validator.validate(header.slice('Bearer '.length));
    return true;
  }
}
