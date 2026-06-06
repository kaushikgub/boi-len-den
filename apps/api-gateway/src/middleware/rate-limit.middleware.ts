import { HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { RedisService } from '@app/common';

/**
 * Fixed-window rate limiter backed by Redis so the limit holds across multiple
 * gateway instances. Keyed by client IP. The first request in a window sets the
 * key's TTL; subsequent ones INCR until the window rolls over.
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly max: number;
  private readonly windowSec: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.max = Number(config.get('RATE_LIMIT_MAX', '100'));
    this.windowSec = Number(config.get('RATE_LIMIT_WINDOW_SEC', '60'));
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip ?? 'unknown';
    const window = Math.floor(Date.now() / 1000 / this.windowSec);
    const key = `ratelimit:${ip}:${window}`;

    const count = await this.redis.client.incr(key);
    if (count === 1) await this.redis.client.expire(key, this.windowSec);

    res.setHeader('X-RateLimit-Limit', this.max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, this.max - count));

    if (count > this.max) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    next();
  }
}
