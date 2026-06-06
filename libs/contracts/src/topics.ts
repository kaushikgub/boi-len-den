import { BOOK_CREATED } from './events/book-created';
import { BOOK_OVERDUE } from './events/book-overdue';
import { BOOK_RENTED } from './events/book-rented';
import { BOOK_RETURNED } from './events/book-returned';
import { PAYMENT_CHARGED } from './events/payment-charged';
import { PAYMENT_REFUNDED } from './events/payment-refunded';

/**
 * Kafka topic names. Both rental-lifecycle topics are partitioned by book_id so
 * that all events for a single book land on one partition and stay ordered —
 * critical for inventory: a rent and its later return must be processed in order.
 * Payment topics are partitioned by rental_id.
 */
export const TOPICS = {
  BOOK_CREATED: 'book-created',
  BOOK_RENTED: 'book-rented',
  BOOK_RETURNED: 'book-returned',
  BOOK_OVERDUE: 'book-overdue',
  PAYMENT_CHARGED: 'payment-charged',
  PAYMENT_REFUNDED: 'payment-refunded',
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];

/** Maps an eventType to the topic it is published on. */
export const EVENT_TOPIC: Record<string, TopicName> = {
  [BOOK_CREATED]: TOPICS.BOOK_CREATED,
  [BOOK_RENTED]: TOPICS.BOOK_RENTED,
  [BOOK_RETURNED]: TOPICS.BOOK_RETURNED,
  [BOOK_OVERDUE]: TOPICS.BOOK_OVERDUE,
  [PAYMENT_CHARGED]: TOPICS.PAYMENT_CHARGED,
  [PAYMENT_REFUNDED]: TOPICS.PAYMENT_REFUNDED,
};
