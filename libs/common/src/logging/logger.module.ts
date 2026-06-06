import { LoggerModule } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';
import { IncomingMessage, ServerResponse } from 'http';
import { CORRELATION_ID_HEADER } from '../correlation/correlation.constants';

/**
 * Builds a nestjs-pino LoggerModule for a service. Every log line carries:
 *  - `service`: which service emitted it
 *  - `correlationId`: pulled from the inbound header or freshly generated, so a
 *    single request can be traced across all hops.
 *
 * The generated/echoed correlation id is also written back onto the response
 * header so callers (and the gateway) can stitch the trace together.
 */
export function buildLoggerModule(service: string) {
  const isProd = process.env.NODE_ENV === 'production';
  return LoggerModule.forRoot({
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
      base: { service },
      // Reuse an inbound correlation id, or mint one at this edge.
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const existing = req.headers[CORRELATION_ID_HEADER];
        const id = (Array.isArray(existing) ? existing[0] : existing) || uuidv4();
        res.setHeader(CORRELATION_ID_HEADER, id);
        return id;
      },
      // Surface the id as a top-level field on every log line for this request.
      customProps: (req: IncomingMessage) => ({
        correlationId: (req as IncomingMessage & { id?: string }).id,
      }),
      // Pretty logs in dev; raw JSON in prod for log shippers.
      transport: isProd
        ? undefined
        : {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:standard' },
          },
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
  });
}
