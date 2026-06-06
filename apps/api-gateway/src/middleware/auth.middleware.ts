import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { JwtValidatorService, USER_ID_HEADER, USER_ROLES_HEADER } from '@app/common';

/**
 * Gateway authentication: validate the access token (signature, expiry, issuer,
 * revocation), then forward a TRUSTED identity context downstream as headers.
 * Applied only to protected route prefixes — public auth routes skip it.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly validator: JwtValidatorService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const user = await this.validator.validate(header.slice('Bearer '.length));
    // Forward the trusted identity downstream. (Spoofed copies were already stripped.)
    req.headers[USER_ID_HEADER] = user.userId;
    req.headers[USER_ROLES_HEADER] = user.roles.join(',');
    next();
  }
}
