import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildLoggerModule, KafkaModule } from '@app/common';
import { ProcessedEvent } from './entities/processed-event.entity';
import { EmailService } from './email.service';
import { NotificationConsumer } from './notification.consumer';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    buildLoggerModule('notification-service'),
    KafkaModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('NOTIFICATION_DATABASE_URL'),
        entities: [ProcessedEvent],
        synchronize: config.get('NODE_ENV') !== 'production',
      }),
    }),
    TypeOrmModule.forFeature([ProcessedEvent]),
  ],
  controllers: [HealthController],
  providers: [EmailService, NotificationConsumer],
})
export class AppModule {}
