import { Global, Module } from '@nestjs/common';
import { JwtValidatorService } from './jwt-validator.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

/**
 * Provides JWT validation + guards. Relies on RedisModule (global) for the
 * denylist check and ConfigService for AUTH_JWKS_URL.
 */
@Global()
@Module({
  providers: [JwtValidatorService, JwtAuthGuard, RolesGuard],
  exports: [JwtValidatorService, JwtAuthGuard, RolesGuard],
})
export class JwtAuthModule {}
