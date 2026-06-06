import { ENVELOPE_REQUIRED, ENVELOPE_SCHEMA_PROPERTIES, EventEnvelope } from './envelope';

export const PAYMENT_REFUNDED = 'PaymentRefunded' as const;

export interface PaymentRefundedPayload {
  paymentId: string;
  rentalId: string;
  bookId: string;
  userId: string;
  amountCents: number;
  refundedAt: string;
}

export type PaymentRefundedEvent = EventEnvelope<typeof PAYMENT_REFUNDED, PaymentRefundedPayload>;

export const PaymentRefundedSchema = {
  $id: 'PaymentRefunded-value',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...ENVELOPE_SCHEMA_PROPERTIES,
    eventType: { const: PAYMENT_REFUNDED },
    payload: {
      type: 'object',
      additionalProperties: false,
      properties: {
        paymentId: { type: 'string', minLength: 1 },
        rentalId: { type: 'string', minLength: 1 },
        bookId: { type: 'string', minLength: 1 },
        userId: { type: 'string', minLength: 1 },
        amountCents: { type: 'integer', minimum: 0 },
        refundedAt: { type: 'string', minLength: 1 },
      },
      required: ['paymentId', 'rentalId', 'bookId', 'userId', 'amountCents', 'refundedAt'],
    },
  },
  required: [...ENVELOPE_REQUIRED],
} as const;
