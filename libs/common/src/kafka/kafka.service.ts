import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka, Producer } from 'kafkajs';
import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';

/**
 * Shared Kafka access: a kafkajs client, a single lazily-connected producer, and
 * a Confluent Schema Registry client. Events are encoded/decoded as JSON Schema
 * through the registry, so every message is schema-validated and carries a schema
 * id — versioning and compatibility are enforced centrally.
 */
@Injectable()
export class KafkaService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  readonly kafka: Kafka;
  readonly registry: SchemaRegistry;
  private producer: Producer | null = null;
  private readonly subjectIds = new Map<string, number>();

  constructor(config: ConfigService) {
    const brokers = config.getOrThrow<string>('KAFKA_BROKERS').split(',');
    const clientId = config.get<string>('SERVICE_NAME', 'boi-len-den');
    this.kafka = new Kafka({ clientId, brokers });
    this.registry = new SchemaRegistry({ host: config.getOrThrow<string>('SCHEMA_REGISTRY_URL') });
  }

  /** Register (or reuse) a JSON Schema for a subject, caching the resulting id. */
  async registerSchema(subject: string, schema: object): Promise<number> {
    const { id } = await this.registry.register(
      { type: SchemaType.JSON, schema: JSON.stringify(schema) },
      { subject },
    );
    this.subjectIds.set(subject, id);
    this.logger.log(`Registered schema for subject ${subject} (id=${id})`);
    return id;
  }

  private async getProducer(): Promise<Producer> {
    if (!this.producer) {
      this.producer = this.kafka.producer({ idempotent: true });
      await this.producer.connect();
    }
    return this.producer;
  }

  /** Encode `value` against the subject's schema and publish it keyed by `key`. */
  async publish(topic: string, subject: string, key: string, value: object): Promise<void> {
    let id = this.subjectIds.get(subject);
    if (id == null) {
      id = await this.registry.getLatestSchemaId(subject);
      this.subjectIds.set(subject, id);
    }
    const encoded = await this.registry.encode(id, value);
    const producer = await this.getProducer();
    await producer.send({ topic, messages: [{ key, value: encoded }] });
  }

  /** Decode a registry-encoded message buffer back into a typed object. */
  decode<T>(buffer: Buffer): Promise<T> {
    return this.registry.decode(buffer) as Promise<T>;
  }

  createConsumer(groupId: string): Consumer {
    return this.kafka.consumer({ groupId });
  }

  async onModuleDestroy() {
    await this.producer?.disconnect();
  }
}
