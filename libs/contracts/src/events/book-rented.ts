import { ENVELOPE_REQUIRED, ENVELOPE_SCHEMA_PROPERTIES, EventEnvelope } from './envelope';

export const BOOK_RENTED = 'BookRented' as const;

/**
 * Emitted by rental-service (via the transactional outbox) once a RESERVED
 * rental is committed. The copy was ALREADY reserved synchronously in
 * inventory-service before this event — so for inventory this event is a
 * confirmation, not the decrement trigger. Other consumers (notification,
 * search) react to it as a pure fan-out.
 */
export interface BookRentedPayload {
  rentalId: string;
  /** The reservation row created during the synchronous reserve call. */
  reservationId: string;
  bookId: string;
  userId: string;
  /** When the rental period ends; drives later overdue detection. */
  dueAt: string;
}

export type BookRentedEvent = EventEnvelope<typeof BOOK_RENTED, BookRentedPayload>;

export const BookRentedSchema = {
  $id: 'BookRented-value',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...ENVELOPE_SCHEMA_PROPERTIES,
    eventType: { const: BOOK_RENTED },
    payload: {
      type: 'object',
      additionalProperties: false,
      properties: {
        rentalId: { type: 'string', minLength: 1 },
        reservationId: { type: 'string', minLength: 1 },
        bookId: { type: 'string', minLength: 1 },
        userId: { type: 'string', minLength: 1 },
        dueAt: { type: 'string', minLength: 1 },
      },
      required: ['rentalId', 'reservationId', 'bookId', 'userId', 'dueAt'],
    },
  },
  required: [...ENVELOPE_REQUIRED],
} as const;
