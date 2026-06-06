import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildLoggerModule, RedisModule } from '@app/common';
import { User } from './users/user.entity';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    buildLoggerModule('auth-service'),
    RedisModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('AUTH_DATABASE_URL'),
        entities: [User],
        // Dev convenience only — Slice 1. Replaced by explicit migrations before prod.
        synchronize: config.get('NODE_ENV') !== 'production',
      }),
    }),
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
