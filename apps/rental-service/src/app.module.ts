import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildLoggerModule, JwtAuthModule, KafkaModule, RedisModule } from '@app/common';
import { Rental } from './entities/rental.entity';
import { OutboxMessage } from './entities/outbox.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { RentalsService } from './rentals.service';
import { RentalsController } from './rentals.controller';
import { InventoryClient } from './inventory.client';
import { RelayService } from './outbox/relay.service';
import { OverdueJob } from './overdue/overdue.job';
import { PaymentConfirmedConsumer } from './payment/payment-confirmed.consumer';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    buildLoggerModule('rental-service'),
    ScheduleModule.forRoot(),
    RedisModule,
    JwtAuthModule,
    KafkaModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('RENTAL_DATABASE_URL'),
        entities: [Rental, OutboxMessage, ProcessedEvent],
        synchronize: config.get('NODE_ENV') !== 'production',
      }),
    }),
    TypeOrmModule.forFeature([Rental, OutboxMessage, ProcessedEvent]),
  ],
  controllers: [RentalsController, HealthController],
  providers: [RentalsService, InventoryClient, RelayService, OverdueJob, PaymentConfirmedConsumer],
})
export class AppModule {}
