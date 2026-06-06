import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Dedupe ledger for the notification consumer. Because Kafka is at-least-once,
 * a BookRented/Returned/Overdue event could arrive more than once. Recording the
 * eventId here (in the same transaction that marks the notification as processed)
 * ensures we never send a duplicate email.
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
