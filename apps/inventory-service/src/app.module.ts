import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildLoggerModule, JwtAuthModule, KafkaModule, RedisModule } from '@app/common';
import { Book } from './entities/book.entity';
import { Reservation } from './entities/reservation.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { ReservationsController } from './reservations.controller';
import { InventoryConsumer } from './inventory.consumer';
import { SweeperService } from './sweeper.service';
import { SeedService } from './seed.service';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    buildLoggerModule('inventory-service'),
    RedisModule,
    JwtAuthModule,
    KafkaModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('INVENTORY_DATABASE_URL'),
        entities: [Book, Reservation, ProcessedEvent],
        synchronize: config.get('NODE_ENV') !== 'production',
      }),
    }),
    TypeOrmModule.forFeature([Book, Reservation, ProcessedEvent]),
  ],
  controllers: [InventoryController, ReservationsController, HealthController],
  providers: [InventoryService, InventoryConsumer, SweeperService, SeedService],
})
export class AppModule {}
