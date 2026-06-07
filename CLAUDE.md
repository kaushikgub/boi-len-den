# boi-len-den — Claude context

Book rental platform built as NestJS microservices. Read this before touching anything.

---

## How to work with this codebase

Kaushik is a senior backend engineer who cares about trade-off reasoning, idempotency, failure modes, and maintainability.

- **Plan before coding.** Lay out the approach and confirm before writing code.
- **Surface trade-offs.** Before any consequential decision (schema shape, sync vs async, service boundary, serialization format) — explain the options with a recommended choice.
- **One vertical slice at a time.** Build end-to-end before scaffolding breadth.
- **Report honestly.** Call out what was verified vs. not. If Docker is down and a check can't run, say so.
- **No unsolicited refactors, comments, or abstractions.** Fix what was asked; leave the rest.

---

## Service map

| Service | Host port | DB port | Owns |
|---|---|---|---|
| api-gateway | 3000 | — | Proxy, JWT auth middleware, rate-limit (Redis), correlation IDs |
| auth-service | 3001 | postgres-auth :5433 | RS256 JWT, rotating refresh tokens (Redis), JWKS endpoint |
| rental-service | 3002 | postgres-rental :5434 | Rent/return lifecycle, overdue cron, transactional outbox |
| inventory-service | 3003 | postgres-inventory :5435 | Copy counts, reservation holds, BookRented/Returned/Created consumer |
| catalog-service | 3004 | postgres-catalog :5436 | Book metadata, FTS (tsvector GIN), Redis cache-aside, BookCreated outbox |
| notification-service | 3005 | postgres-notification :5437 | Email dispatch for book-rented/returned/overdue; dedup via processed_events |
| payment-service | 3006 | postgres-payment :5438 | Mock charges/refunds, idempotent via rental_id UNIQUE, PaymentCharged/Refunded outbox |
| web-frontend | 5173 (dev) / 80 (Docker) | — | React SPA — nginx in Docker, Vite dev-server on host |
| kafka-ui | 8080 | — | Topics, messages, consumer groups, Schema Registry |
| Mailpit | 8025 / 1025 | — | SMTP trap (web UI / SMTP port) |
| RedisInsight | 8001 | — | Browse Redis keys |

---

## How to run

**Full Docker stack:**
```bash
pnpm stack:up            # docker compose up -d --build  (first boot auto-generates RSA keys)
pnpm stack:down          # stop, keep volumes
pnpm stack:down:clean    # stop + wipe all volumes (full reset)
```

**Host dev mode (infra in Docker, services hot-reloaded on host):**
```bash
pnpm infra:up            # Postgres×5, Redis, Kafka, Schema Registry, Mailpit, UIs
cp .env.example .env     # fill once

# Start in this order (each in its own terminal):
pnpm start:auth          # :3001  — must be first (others validate against its JWKS)
pnpm start:inventory     # :3003
pnpm start:catalog       # :3004
pnpm start:rental        # :3002
pnpm start:payment       # :3006
pnpm start:notification  # :3005
pnpm start:gateway       # :3000
cd web-frontend && pnpm dev   # :5173
```

**Integration tests (require infra up):**
```bash
pnpm test:int
```

**Dev credentials:**
- Member: `reader@example.com` / `supersecret`
- Admin+librarian: `admin@boi-len-den.local` / `admin12345`

---

## Kafka topics & event flow

| Topic | Partitions | Producer | Consumers |
|---|---|---|---|
| `book-created` | 6 | catalog-service (outbox relay) | inventory-service |
| `book-rented` | 6 | rental-service (outbox relay) | inventory-service, notification-service, payment-service |
| `book-returned` | 6 | rental-service (outbox relay) | inventory-service, notification-service, payment-service |
| `book-overdue` | 6 | rental-service (outbox relay) | notification-service |
| `payment-charged` | 6 | payment-service (outbox relay) | rental-service |
| `payment-refunded` | 6 | payment-service (outbox relay) | — (logged only) |

**BookCreated:** Admin `POST /api/catalog/books` → catalog writes Book + outbox row (same tx) → relay → inventory creates its own Book record (`ON CONFLICT DO NOTHING` on PK = idempotent).

**Rent:** Redis SET NX (fast gate) → `inventory.reserve()` (atomic `UPDATE WHERE available_copies > 0` = real last-copy guard) → rental writes RESERVED + outbox → relay publishes `book-rented` → payment charges $5 + publishes `payment-charged` → rental consumes `payment-charged` → RESERVED → ACTIVE → notification sends confirmation email.

**Return:** `POST /api/rentals/:id/return` → rental tx + outbox → relay publishes `book-returned` → inventory increments copies (idempotent via `processed_events`), payment issues refund, notification sends confirmation email.

**Overdue:** `@Cron` every hour in rental-service → marks ACTIVE rentals past `dueAt` as OVERDUE → outbox publishes `book-overdue` → notification sends warning email.

---

## Key non-obvious decisions

**Last-copy guard is synchronous Postgres, not event-driven.**
`UPDATE books SET available_copies = available_copies - 1 WHERE id = :id AND available_copies > 0`. Redis SET NX is only a pre-filter. Kafka BookRented is fan-out — inventory does NOT re-decrement on it.

**JSON Schema: no `format` keywords.**
Confluent registry's JSON validator rejects `format: 'uuid'`/`'date-time'`. All schemas use `{ type: 'string', minLength: 1 }`. Schema registration uses the registry REST API directly — the kafkajs client's `register()` mishandles new JSON subjects.

**`"webpack": true` in `nest-cli.json` is required.**
Without it, TypeScript output nests as `dist/apps/auth-service/apps/auth-service/src/main.js` and `@app/*` aliases break at runtime.

**Transactional outbox everywhere.**
Event written in same DB transaction as the state change. Relay polls with `FOR UPDATE SKIP LOCKED`. Never "commit then publish".

**Idempotent consumers: `processed_events` table.**
`INSERT INTO processed_events (event_id, event_type) ... ON CONFLICT DO NOTHING` in the same transaction as the side effect. Zero-overhead dedupe.

**Rotating refresh tokens.**
Stored as `<UUID>.<hex-32>` in Redis; only SHA-256 of secret is persisted. Single-use (deleted on rotation). Denylist: `denylist:jti:<jti>` in Redis with TTL = remaining access token lifetime.

**React StrictMode + single-use refresh tokens.**
Bootstrap uses a `ref` guard (`bootstrapped.current`), NOT an `active`/cleanup pattern. Cleanup set `active = false` on the first effect teardown → stranded promise → loading spinner forever.

**pnpm in Docker: single-stage Dockerfile.**
Multi-stage `COPY --from` breaks pnpm's virtual-store symlinks. Solution: one stage — `pnpm install --frozen-lockfile`, then `nest build ${SERVICE}`, then `cp dist/apps/${SERVICE}/main.js dist/main.js`.

**Catalog FTS: tsvector GENERATED ALWAYS AS STORED + GIN index.**
TypeORM `synchronize` creates the column but can't emit GIN DDL from a decorator. `CatalogSetupService.onModuleInit()` runs `CREATE INDEX IF NOT EXISTS ... USING GIN` on every boot (idempotent).

---

## Important file landmarks

| File | What's there |
|---|---|
| `libs/contracts/src/` | All event types, JSON Schemas, topic names — single source of truth for the event contract |
| `libs/common/src/` | Shared: Redis, Kafka+SchemaRegistry client, JWT validator (JWKS), auth guards, correlation ID header |
| `apps/auth-service/src/auth/token.service.ts` | RS256 JWT issue, refresh token rotation, revocation |
| `apps/auth-service/src/users/users.service.ts` | User creation and lookup |
| `apps/auth-service/src/users/internal.controller.ts` | Internal user lookup endpoint (called by other services) |
| `apps/inventory-service/src/inventory.service.ts` | `reserve()` (last-copy guard), `applyReturn()` (idempotent), `createBookFromEvent()` |
| `apps/rental-service/src/rentals.service.ts` | `rent()` — Redis gate → reserve → DB tx + outbox; `returnBook()`; `OverdueJob` cron |
| `apps/rental-service/src/rentals.controller.ts` | Rental HTTP endpoints |
| `apps/rental-service/src/dto.ts` | Rental DTOs |
| `apps/rental-service/src/outbox/relay.service.ts` | **Canonical outbox relay pattern** — copy this for any new outbox producer |
| `apps/catalog-service/src/catalog.service.ts` | `createBook()` with outbox, Redis cache-aside, FTS search |
| `apps/catalog-service/src/catalog-setup.service.ts` | GIN index bootstrap on startup |
| `apps/catalog-service/src/internal.controller.ts` | Internal book lookup endpoint |
| `apps/catalog-service/src/dto.ts` | Catalog DTOs |
| `apps/payment-service/src/payment.service.ts` | Mock charge/refund, idempotent via `rental_id UNIQUE`, outbox relay |
| `apps/payment-service/src/payment.controller.ts` | Payment HTTP endpoints |
| `apps/payment-service/src/dto.ts` | Payment DTOs |
| `apps/notification-service/src/notification.consumer.ts` | Kafka consumer for all three events; dedup; email dispatch |
| `apps/notification-service/src/email.service.ts` | nodemailer wrapper; Mailpit in dev |
| `apps/api-gateway/src/routes.ts` | Gateway route table (prefix → target service) |
| `apps/api-gateway/src/middleware/` | JWT auth, rate-limit, strip-identity middlewares |
| `apps/inventory-service/test/last-copy.int-spec.ts` | Milestone: 50 concurrent reservers, exactly 1 wins |
| `apps/catalog-service/test/catalog.int-spec.ts` | FTS correctness + outbox-in-same-tx tests |
| `web-frontend/src/api/client.ts` | Access token in module variable, single-flight refresh across concurrent 401s |
| `web-frontend/src/auth/AuthContext.tsx` | Bootstrap with `bootstrapped.current` ref guard |
| `web-frontend/src/api/books.ts` | Book API calls |
| `web-frontend/src/api/rentals.ts` | Rental API calls |
| `web-frontend/src/api/payments.ts` | Payment API calls |
| `web-frontend/src/api/types.ts` | Shared API types |
| `web-frontend/src/queryKeys.ts` | TanStack Query key definitions |
| `web-frontend/src/components/Layout.tsx` | Sidebar nav layout |
| `web-frontend/src/pages/AdminBooksPage.tsx` | Admin book management |
| `web-frontend/src/pages/BookDetailPage.tsx` | Book detail + rent |
| `web-frontend/src/pages/MyRentalsPage.tsx` | My rentals + return + overdue banner |
| `web-frontend/src/pages/PaymentsPage.tsx` | Payment history |
| `Dockerfile` | Shared NestJS Dockerfile — `ARG SERVICE` selects which app |
| `web-frontend/Dockerfile` | Vite build + nginx multi-stage |
| `web-frontend/nginx.conf` | Proxy `/api` → `http://api-gateway:3000`; SPA fallback to `index.html` |
| `docker-compose.yml` | Full stack: all services + `keys-init` + kafka-ui + Mailpit + RedisInsight |
