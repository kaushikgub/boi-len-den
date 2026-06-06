import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { buildLoggerModule } from '@app/common';
import { HealthController } from './health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), buildLoggerModule('inventory-service')],
  controllers: [HealthController],
})
export class AppModule {}
