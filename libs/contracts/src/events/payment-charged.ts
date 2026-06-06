import { ENVELOPE_REQUIRED, ENVELOPE_SCHEMA_PROPERTIES, EventEnvelope } from './envelope';

export const PAYMENT_CHARGED = 'PaymentCharged' as const;

export interface PaymentChargedPayload {
  paymentId: string;
  rentalId: string;
  bookId: string;
  userId: string;
  /** Fixed rental fee in cents (e.g. 500 = $5.00). */
  amountCents: number;
  chargedAt: string;
}

export type PaymentChargedEvent = EventEnvelope<typeof PAYMENT_CHARGED, PaymentChargedPayload>;

export const PaymentChargedSchema = {
  $id: 'PaymentCharged-value',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...ENVELOPE_SCHEMA_PROPERTIES,
    eventType: { const: PAYMENT_CHARGED },
    payload: {
      type: 'object',
      additionalProperties: false,
      properties: {
        paymentId: { type: 'string', minLength: 1 },
        rentalId: { type: 'string', minLength: 1 },
        bookId: { type: 'string', minLength: 1 },
        userId: { type: 'string', minLength: 1 },
        amountCents: { type: 'integer', minimum: 0 },
        chargedAt: { type: 'string', minLength: 1 },
      },
      required: ['paymentId', 'rentalId', 'bookId', 'userId', 'amountCents', 'chargedAt'],
    },
  },
  required: [...ENVELOPE_REQUIRED],
} as const;
