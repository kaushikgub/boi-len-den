import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import {
  PAYMENT_CHARGED,
  PAYMENT_REFUNDED,
  PaymentChargedSchema,
  PaymentRefundedSchema,
} from '@app/contracts';

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

const validators: Record<string, ValidateFunction> = {
  [PAYMENT_CHARGED]: ajv.compile(PaymentChargedSchema),
  [PAYMENT_REFUNDED]: ajv.compile(PaymentRefundedSchema),
};

export function validateEvent(
  eventType: string,
  payload: unknown,
): { valid: boolean; errors: string | null } {
  const validate = validators[eventType];
  if (!validate) return { valid: false, errors: `no schema for event type ${eventType}` };
  const valid = validate(payload);
  return { valid, errors: valid ? null : ajv.errorsText(validate.errors) };
}
