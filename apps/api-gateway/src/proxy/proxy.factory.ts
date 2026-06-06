import { RequestHandler } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { randomUUID } from 'crypto';
import { CORRELATION_ID_HEADER } from '@app/common';
import { RouteDef } from '../routes';

/**
 * Builds a reverse-proxy handler for one route. The proxy is mounted at the
 * route prefix (Express strips it), so the remaining path is appended to the
 * service's internal base. A correlation id is always propagated downstream
 * (reusing an inbound one, or minting it here at the edge).
 */
export function buildProxy(route: RouteDef, target: string): RequestHandler {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    // Mounted at route.prefix → `path` here is already prefix-stripped.
    pathRewrite: (path) => `${route.rewriteTo}${path === '/' ? '' : path}`,
    on: {
      proxyReq: (proxyReq, req) => {
        const existing = req.headers[CORRELATION_ID_HEADER];
        const correlationId =
          (Array.isArray(existing) ? existing[0] : existing) ||
          (req as { id?: string }).id ||
          randomUUID();
        proxyReq.setHeader(CORRELATION_ID_HEADER, correlationId);
      },
      error: (_err, _req, res) => {
        // Downstream unreachable — surface a clean 502 instead of hanging.
        const response = res as unknown as {
          headersSent?: boolean;
          writeHead?: (s: number, h: Record<string, string>) => void;
          end?: (b: string) => void;
        };
        if (response.writeHead && !response.headersSent) {
          response.writeHead(502, { 'Content-Type': 'application/json' });
          response.end?.(JSON.stringify({ statusCode: 502, message: 'Bad gateway' }));
        }
      },
    },
  }) as unknown as RequestHandler;
}
