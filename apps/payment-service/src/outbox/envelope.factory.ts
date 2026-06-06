import { randomUUID } from 'crypto';
import { EventEnvelope } from '@app/contracts';

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
