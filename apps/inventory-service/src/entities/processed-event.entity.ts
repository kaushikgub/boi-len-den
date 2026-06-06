import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Dedupe ledger for the idempotent Kafka consumer. Kafka is at-least-once, so a
 * BookReturned could be delivered twice — recording the eventId here (and writing
 * it in the SAME transaction as the side effect) guarantees the increment happens
 * exactly once.
 */
@Entity({ name: 'processed_events' })
export class ProcessedEvent {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ type: 'text' })
  eventType!: string;

  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt!: Date;
}
