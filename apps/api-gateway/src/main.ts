import { NestFactory } from '@nestjs/core';
import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import type { Express, NextFunction, Request, RequestHandler, Response } from 'express';
import { JwtValidatorService, RedisService } from '@app/common';
import { AppModule } from './app.module';
import { AuthMiddleware } from './middleware/auth.middleware';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { stripIdentityHeaders } from './middleware/strip-identity.middleware';
import { ROUTES } from './routes';
import { buildProxy } from './proxy/proxy.factory';

/** Wrap async middleware so rejections reach the Express error handler. */
const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

async function bootstrap() {
  // bodyParser disabled: the gateway streams request bodies straight to services.
  const app = await NestFactory.create(AppModule, { bodyParser: false, bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const rateLimit = new RateLimitMiddleware(app.get(RedisService), config);
  const auth = new AuthMiddleware(app.get(JwtValidatorService));
  const http = app.getHttpAdapter().getInstance() as Express;
  http.set('trust proxy', true);

  for (const route of ROUTES) {
    const target = config.get<string>(route.targetEnv) ?? route.targetDefault;
    const chain: RequestHandler[] = [
      stripIdentityHeaders, // never trust client-supplied identity
      wrap((req, res, next) => rateLimit.use(req, res, next)),
    ];
    if (route.protected) {
      chain.push(wrap((req, res, next) => auth.use(req, res, next)));
    }
    chain.push(buildProxy(route, target));
    http.use(route.prefix, ...chain);
    app.get(Logger).log(`route ${route.prefix} -> ${target}${route.rewriteTo} (protected=${route.protected})`);
  }

  // Translate thrown HttpExceptions from the middleware chain into JSON responses.
  http.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    if (err instanceof HttpException) {
      return res.status(err.getStatus()).json({
        statusCode: err.getStatus(),
        message: err.message,
      });
    }
    res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  });

  const port = config.get('PORT') ?? 3000;
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`api-gateway listening on ${port}`);
}
bootstrap();
