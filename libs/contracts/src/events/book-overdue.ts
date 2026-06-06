import { ENVELOPE_REQUIRED, ENVELOPE_SCHEMA_PROPERTIES, EventEnvelope } from './envelope';

export const BOOK_OVERDUE = 'BookOverdue' as const;

/**
 * Emitted by rental-service when the overdue cron job marks an ACTIVE rental
 * as OVERDUE (dueAt has passed). Consumed by notification-service to send a
 * reminder email to the borrower.
 */
export interface BookOverduePayload {
  rentalId: string;
  bookId: string;
  userId: string;
  /** Original due date — ISO-8601. */
  dueAt: string;
}

export type BookOverdueEvent = EventEnvelope<typeof BOOK_OVERDUE, BookOverduePayload>;

export const BookOverdueSchema = {
  $id: 'BookOverdue-value',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...ENVELOPE_SCHEMA_PROPERTIES,
    eventType: { const: BOOK_OVERDUE },
    payload: {
      type: 'object',
      additionalProperties: false,
      properties: {
        rentalId: { type: 'string', minLength: 1 },
        bookId: { type: 'string', minLength: 1 },
        userId: { type: 'string', minLength: 1 },
        dueAt: { type: 'string', minLength: 1 },
      },
      required: ['rentalId', 'bookId', 'userId', 'dueAt'],
    },
  },
  required: [...ENVELOPE_REQUIRED],
} as const;
