import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildLoggerModule, JwtAuthModule, KafkaModule, RedisModule } from '@app/common';
import { Book } from './entities/book.entity';
import { OutboxMessage } from './entities/outbox.entity';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { RelayService } from './outbox/relay.service';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    buildLoggerModule('catalog-service'),
    RedisModule,
    JwtAuthModule,
    KafkaModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('CATALOG_DATABASE_URL'),
        entities: [Book, OutboxMessage],
        synchronize: config.get('NODE_ENV') !== 'production',
      }),
    }),
    TypeOrmModule.forFeature([Book, OutboxMessage]),
  ],
  controllers: [CatalogController, HealthController],
  providers: [CatalogService, RelayService],
})
export class AppModule {}
