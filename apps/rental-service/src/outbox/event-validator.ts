import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import {
  BOOK_OVERDUE,
  BOOK_RENTED,
  BOOK_RETURNED,
  BookOverdueSchema,
  BookRentedSchema,
  BookReturnedSchema,
} from '@app/contracts';

/**
 * Belt-and-suspenders validation of outbox payloads against the contract JSON
 * Schemas before they go to Kafka. The registry validates on encode too, but
 * catching a malformed event here keeps a bad row from being retried forever as
 * a registry error — we can flag it as poison instead.
 */
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

const validators: Record<string, ValidateFunction> = {
  [BOOK_RENTED]: ajv.compile(BookRentedSchema),
  [BOOK_RETURNED]: ajv.compile(BookReturnedSchema),
  [BOOK_OVERDUE]: ajv.compile(BookOverdueSchema),
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
