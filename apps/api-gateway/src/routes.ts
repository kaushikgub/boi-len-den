/**
 * Gateway route table. Each public path prefix maps to a downstream service and
 * is rewritten to that service's internal path. `protected: true` means the
 * request must carry a valid access token (AuthMiddleware runs first).
 *
 * Slice 1 surfaces: auth (public), book availability + rentals (protected).
 * Catalog arrives in Slice 2; for now inventory-service serves minimal book data.
 */
export interface RouteDef {
  prefix: string;
  /** Env var holding the target base URL, with a localhost default. */
  targetEnv: string;
  targetDefault: string;
  /** The prefix is rewritten to this before forwarding. */
  rewriteTo: string;
  protected: boolean;
}

export const ROUTES: RouteDef[] = [
  {
    prefix: '/api/auth',
    targetEnv: 'AUTH_SERVICE_URL',
    targetDefault: 'http://localhost:3001',
    rewriteTo: '/auth',
    protected: false,
  },
  {
    prefix: '/api/books',
    targetEnv: 'INVENTORY_SERVICE_URL',
    targetDefault: 'http://localhost:3003',
    rewriteTo: '/inventory/books',
    protected: true,
  },
  {
    prefix: '/api/rentals',
    targetEnv: 'RENTAL_SERVICE_URL',
    targetDefault: 'http://localhost:3002',
    rewriteTo: '/rentals',
    protected: true,
  },
  {
    prefix: '/api/catalog',
    targetEnv: 'CATALOG_SERVICE_URL',
    targetDefault: 'http://localhost:3004',
    rewriteTo: '/catalog',
    protected: true,
  },
  {
    prefix: '/api/payments',
    targetEnv: 'PAYMENT_SERVICE_URL',
    targetDefault: 'http://localhost:3006',
    rewriteTo: '/payments',
    protected: true,
  },
];
