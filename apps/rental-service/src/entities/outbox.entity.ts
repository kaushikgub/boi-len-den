import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { EventEnvelope } from '@app/contracts';

/**
 * Transactional outbox. A domain event is written here in the SAME transaction as
 * the rental state change, so the event can never be lost on a crash between
 * "commit state" and "publish" (the classic dual-write bug). A polling relay
 * later reads unpublished rows and pushes them to Kafka.
 *
 * `payload` is the complete event envelope; `topic`/`subject`/`key` tell the
 * relay where and how to publish it.
 */
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

  /** Kafka partition key (book_id) — preserves per-book ordering. */
  @Column({ name: 'message_key', type: 'text' })
  messageKey!: string;

  @Column({ type: 'jsonb' })
  payload!: EventEnvelope;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** Null until the relay successfully publishes it. */
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  attempts!: number;
}
