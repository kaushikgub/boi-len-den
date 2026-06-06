/**
 * Every Kafka event is wrapped in this envelope. Consumers dedupe on `eventId`
 * (Kafka is at-least-once), order within a partition is guaranteed by `key`
 * (book_id for the rental events), and `correlationId` is propagated from the
 * gateway through every hop for tracing.
 *
 * `eventType` + `schemaVersion` together identify which payload schema applies;
 * the JSON Schema registered under `<eventType>-value` validates `payload`.
 */
export interface EventEnvelope<TType extends string = string, TPayload = unknown> {
  /** UUID v4 — the idempotency key consumers dedupe on. */
  eventId: string;
  /** Discriminator, e.g. "BookRented". Maps to a registered schema subject. */
  eventType: TType;
  /** Monotonic per eventType; bump on incompatible payload changes. */
  schemaVersion: number;
  /** ISO-8601 UTC timestamp of when the fact occurred. */
  occurredAt: string;
  /** Partition/ordering key. For rental events this is the book_id. */
  key: string;
  /** Trace id originated at the gateway, carried across all services. */
  correlationId: string;
  /** Event-specific body, validated against the registered schema. */
  payload: TPayload;
}

/** JSON Schema fragment for the envelope fields shared by every event. */
export const ENVELOPE_SCHEMA_PROPERTIES = {
  eventId: { type: 'string', format: 'uuid' },
  eventType: { type: 'string', minLength: 1 },
  schemaVersion: { type: 'integer', minimum: 1 },
  occurredAt: { type: 'string', format: 'date-time' },
  key: { type: 'string', minLength: 1 },
  correlationId: { type: 'string', minLength: 1 },
} as const;

export const ENVELOPE_REQUIRED = [
  'eventId',
  'eventType',
  'schemaVersion',
  'occurredAt',
  'key',
  'correlationId',
  'payload',
] as const;
