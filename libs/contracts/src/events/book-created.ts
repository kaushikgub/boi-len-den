import { ENVELOPE_REQUIRED, ENVELOPE_SCHEMA_PROPERTIES, EventEnvelope } from './envelope';

export const BOOK_CREATED = 'BookCreated' as const;

export interface BookCreatedPayload {
  bookId: string;
  title: string;
  author: string;
  totalCopies: number;
  coverUrl?: string | null;
}

export type BookCreatedEvent = EventEnvelope<typeof BOOK_CREATED, BookCreatedPayload>;

export const BookCreatedSchema = {
  $id: 'BookCreated-value',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...ENVELOPE_SCHEMA_PROPERTIES,
    eventType: { const: BOOK_CREATED },
    payload: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bookId: { type: 'string', minLength: 1 },
        title: { type: 'string', minLength: 1 },
        author: { type: 'string', minLength: 1 },
        totalCopies: { type: 'integer', minimum: 1 },
        coverUrl: { type: 'string', minLength: 1 },
      },
      required: ['bookId', 'title', 'author', 'totalCopies'],
    },
  },
  required: [...ENVELOPE_REQUIRED],
} as const;
