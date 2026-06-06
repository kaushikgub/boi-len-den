import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** Dedupe ledger for the PaymentConfirmedConsumer. */
@Entity({ name: 'processed_events' })
export class ProcessedEvent {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ type: 'text' })
  eventType!: string;

  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt!: Date;
}
