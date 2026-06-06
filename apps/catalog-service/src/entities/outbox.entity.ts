import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { EventEnvelope } from '@app/contracts';

@Entity({ name: 'outbox' })
@Index(['publishedAt', 'createdAt'])
export class OutboxMessage {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'event_type', type: 'text' })
  eventType!: string;

  @Column({ type: 'text' })
  topic!: string;

  @Column({ type: 'text' })
  subject!: string;

  @Column({ name: 'message_key', type: 'text' })
  messageKey!: string;

  @Column({ type: 'jsonb' })
  payload!: EventEnvelope;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  attempts!: number;
}
