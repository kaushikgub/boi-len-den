import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT, RedisService } from './redis.service';

/**
 * Global Redis module. Reads REDIS_URL from config and exposes a single shared
 * ioredis connection via RedisService. Import once per service.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL', 'redis://localhost:6379');
        return new Redis(url, { maxRetriesPerRequest: null });
      },
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
