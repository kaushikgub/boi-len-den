import { ENVELOPE_REQUIRED, ENVELOPE_SCHEMA_PROPERTIES, EventEnvelope } from './envelope';

export const BOOK_CREATED = 'BookCreated' as const;

export interface BookCreatedPayload {
  bookId: string;
  title: string;
  /** Denormalized into inventory so it can display the title until Slice 2 Step 3
   *  migrates book-reads fully to catalog. */
  author: string;
  totalCopies: number;
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
      },
      required: ['bookId', 'title', 'author', 'totalCopies'],
    },
  },
  required: [...ENVELOPE_REQUIRED],
} as const;
