import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { buildLoggerModule, JwtAuthModule, RedisModule } from '@app/common';
import { HealthController } from './health.controller';

/**
 * The gateway is a thin Nest shell: it provides DI (Redis, JWT validation, config,
 * logging) and a /health endpoint. The actual routing/auth/rate-limit/proxy stack
 * is wired as Express middleware in main.ts using these providers. No business logic.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    buildLoggerModule('api-gateway'),
    RedisModule,
    JwtAuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
