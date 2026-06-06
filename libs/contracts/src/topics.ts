import { BOOK_RENTED } from './events/book-rented';
import { BOOK_RETURNED } from './events/book-returned';

/**
 * Kafka topic names. Both rental-lifecycle topics are partitioned by book_id so
 * that all events for a single book land on one partition and stay ordered —
 * critical for inventory: a rent and its later return must be processed in order.
 */
export const TOPICS = {
  BOOK_RENTED: 'book-rented',
  BOOK_RETURNED: 'book-returned',
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];

/** Maps an eventType to the topic it is published on. */
export const EVENT_TOPIC: Record<string, TopicName> = {
  [BOOK_RENTED]: TOPICS.BOOK_RENTED,
  [BOOK_RETURNED]: TOPICS.BOOK_RETURNED,
};
