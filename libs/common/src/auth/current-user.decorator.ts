import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from './authenticated-user';
import { RequestWithUser } from './jwt-auth.guard';

/** Injects the validated user (set by JwtAuthGuard) into a handler param. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    return ctx.switchToHttp().getRequest<RequestWithUser>().user;
  },
);
