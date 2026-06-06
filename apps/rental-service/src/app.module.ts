import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildLoggerModule, JwtAuthModule, KafkaModule, RedisModule } from '@app/common';
import { Rental } from './entities/rental.entity';
import { OutboxMessage } from './entities/outbox.entity';
import { RentalsService } from './rentals.service';
import { RentalsController } from './rentals.controller';
import { InventoryClient } from './inventory.client';
import { RelayService } from './outbox/relay.service';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    buildLoggerModule('rental-service'),
    RedisModule,
    JwtAuthModule,
    KafkaModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('RENTAL_DATABASE_URL'),
        entities: [Rental, OutboxMessage],
        synchronize: config.get('NODE_ENV') !== 'production',
      }),
    }),
    TypeOrmModule.forFeature([Rental, OutboxMessage]),
  ],
  controllers: [RentalsController, HealthController],
  providers: [RentalsService, InventoryClient, RelayService],
})
export class AppModule {}
