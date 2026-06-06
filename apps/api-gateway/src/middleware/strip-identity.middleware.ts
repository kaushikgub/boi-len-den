import { NextFunction, Request, Response } from 'express';
import { USER_ID_HEADER, USER_ROLES_HEADER } from '@app/common';

/**
 * Clients must never be able to assert their own identity. Strip the trusted
 * identity headers off every inbound request before anything else runs; only the
 * gateway's auth middleware is allowed to set them after validating the token.
 */
export function stripIdentityHeaders(req: Request, _res: Response, next: NextFunction) {
  delete req.headers[USER_ID_HEADER];
  delete req.headers[USER_ROLES_HEADER];
  next();
}
