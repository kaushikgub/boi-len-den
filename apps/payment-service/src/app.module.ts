import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildLoggerModule, JwtAuthModule, KafkaModule, RedisModule } from '@app/common';
import { Payment } from './entities/payment.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { OutboxMessage } from './entities/outbox.entity';
import { PaymentService } from './payment.service';
import { PaymentConsumer } from './payment.consumer';
import { PaymentController } from './payment.controller';
import { RelayService } from './outbox/relay.service';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    buildLoggerModule('payment-service'),
    RedisModule,
    JwtAuthModule,
    KafkaModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('PAYMENT_DATABASE_URL'),
        entities: [Payment, ProcessedEvent, OutboxMessage],
        synchronize: config.get('NODE_ENV') !== 'production',
      }),
    }),
    TypeOrmModule.forFeature([Payment, ProcessedEvent, OutboxMessage]),
  ],
  controllers: [PaymentController, HealthController],
  providers: [PaymentService, PaymentConsumer, RelayService],
})
export class AppModule {}
