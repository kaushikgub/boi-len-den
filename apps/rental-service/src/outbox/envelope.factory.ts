import { randomUUID } from 'crypto';
import { EventEnvelope } from '@app/contracts';

/** Build a fully-populated event envelope ready to be written to the outbox. */
export function buildEnvelope<TType extends string, TPayload>(
  eventType: TType,
  schemaVersion: number,
  key: string,
  correlationId: string,
  payload: TPayload,
): EventEnvelope<TType, TPayload> {
  return {
    eventId: randomUUID(),
    eventType,
    schemaVersion,
    occurredAt: new Date().toISOString(),
    key,
    correlationId,
    payload,
  };
}
