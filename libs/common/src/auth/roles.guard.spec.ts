import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard, ROLES_KEY } from './roles.guard';
import { Role } from './authenticated-user';

function contextWithUserRoles(roles: Role[] | undefined): ExecutionContext {
  const req = roles ? { user: { roles } } : {};
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function guardRequiring(required: Role[] | undefined) {
  const reflector = {
    getAllAndOverride: (key: string) => (key === ROLES_KEY ? required : undefined),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows the route when no roles are required', () => {
    expect(guardRequiring(undefined).canActivate(contextWithUserRoles(['member']))).toBe(true);
  });

  it('allows when the user has one of the required roles', () => {
    expect(guardRequiring(['admin', 'librarian']).canActivate(contextWithUserRoles(['librarian']))).toBe(
      true,
    );
  });

  it('denies when the user lacks every required role', () => {
    expect(guardRequiring(['admin']).canActivate(contextWithUserRoles(['member']))).toBe(false);
  });

  it('denies when there is no authenticated user', () => {
    expect(guardRequiring(['admin']).canActivate(contextWithUserRoles(undefined))).toBe(false);
  });
});
