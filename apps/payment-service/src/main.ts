import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const port = process.env.PORT ?? 3006;
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`payment-service listening on ${port}`);
}
bootstrap();
