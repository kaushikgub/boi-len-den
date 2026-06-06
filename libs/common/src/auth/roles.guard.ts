import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './authenticated-user';
import { RequestWithUser } from './jwt-auth.guard';

export const ROLES_KEY = 'required_roles';

/** Restrict a route to the given roles. Pair with JwtAuthGuard (which sets req.user). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    return !!user && required.some((role) => user.roles?.includes(role));
  }
}
