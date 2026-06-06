import { ENVELOPE_REQUIRED, ENVELOPE_SCHEMA_PROPERTIES, EventEnvelope } from './envelope';

export const BOOK_RETURNED = 'BookReturned' as const;

/**
 * Emitted by rental-service (via outbox) when a rental transitions to RETURNED.
 * inventory-service consumes this to increment availability — and MUST dedupe on
 * eventId, because at-least-once delivery means a duplicate must not increment twice.
 * payment-service consumes it to settle fees.
 */
export interface BookReturnedPayload {
  rentalId: string;
  bookId: string;
  userId: string;
  returnedAt: string;
  /** True if returned after dueAt; lets payment decide on late fees. */
  wasOverdue: boolean;
}

export type BookReturnedEvent = EventEnvelope<typeof BOOK_RETURNED, BookReturnedPayload>;

export const BookReturnedSchema = {
  $id: 'BookReturned-value',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...ENVELOPE_SCHEMA_PROPERTIES,
    eventType: { const: BOOK_RETURNED },
    payload: {
      type: 'object',
      additionalProperties: false,
      properties: {
        rentalId: { type: 'string', format: 'uuid' },
        bookId: { type: 'string', format: 'uuid' },
        userId: { type: 'string', format: 'uuid' },
        returnedAt: { type: 'string', format: 'date-time' },
        wasOverdue: { type: 'boolean' },
      },
      required: ['rentalId', 'bookId', 'userId', 'returnedAt', 'wasOverdue'],
    },
  },
  required: [...ENVELOPE_REQUIRED],
} as const;
