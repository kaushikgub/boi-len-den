# boi-len-den — Claude context

Book rental platform built as NestJS microservices. Read this before touching anything.

---

## Current status (2026-06-06)

| Slice | What | Status |
|---|---|---|
| 1 | auth + gateway + inventory + rental + web-frontend | ✅ done |
| 2 | catalog-service + Redis cache + Postgres FTS + BookCreated event + full Docker Compose | ✅ done |
| 3 | overdue detection + notification-service | 🔲 next |
| 4 | payment-service (idempotent) | 🔲 pending |
| 5 | Kubernetes / Helm | 🔲 pending |

---

## Service map

| Service | Host port | DB port | Owns |
|---|---|---|---|
| api-gateway | 3000 | — | proxy, JWT auth middleware, rate-limit (Redis), correlation IDs |
| auth-service | 3001 | postgres-auth :5433 | RS256 JWT, rotating refresh tokens (Redis), JWKS endpoint |
| rental-service | 3002 | postgres-rental :5434 | rent/return lifecycle, transactional outbox |
| inventory-service | 3003 | postgres-inventory :5435 | copy counts, reservation holds, BookRented/Returned/Created consumer |
| catalog-service | 3004 | postgres-catalog :5436 | book metadata, FTS (tsvector GIN), Redis cache-aside, BookCreated outbox |
| web-frontend | 5173 | — | React SPA — nginx in Docker, Vite dev-server on host |
| kafka-ui | 8080 | — | topics, messages, consumer groups, Schema Registry |
| RedisInsight | 8001 | — | browse Redis keys |

---

## How to run

**Full Docker stack:**
```bash
pnpm stack:up            # docker compose up -d --build  (first boot generates RSA keys)
pnpm stack:down          # stop, keep volumes
pnpm stack:down:clean    # stop + wipe all volumes
```

**Host dev mode (infra in Docker, services hot-reloaded on host):**
```bash
pnpm infra:up            # Postgres×4, Redis, Kafka, Schema Registry, UIs
cp .env.example .env     # fill once
pnpm start:auth          # :3001
pnpm start:inventory     # :3003
pnpm start:rental        # :3002
pnpm start:catalog       # :3004
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

| Topic | Producer | Consumers |
|---|---|---|
| `book-created` | catalog-service (outbox relay) | inventory-service |
| `book-rented` | rental-service (outbox relay) | inventory-service |
| `book-returned` | rental-service (outbox relay) | inventory-service |

**BookCreated:** Admin `POST /api/catalog/books` → catalog writes Book + outbox row (same tx) → relay → inventory creates its own Book record (idempotent: `ON CONFLICT DO NOTHING` on PK).

**Rent:** Redis SET NX (fast gate) → `inventory.reserve()` (atomic `UPDATE WHERE available_copies > 0`, Postgres row lock is the real last-copy guard) → rental DB tx + outbox row → relay → inventory confirms reservation (no count change — already decremented synchronously).

**Return:** `POST /api/rentals/:id/return` → rental tx + outbox → relay → inventory `applyReturn()` (dedupe by eventId in `processed_events`, then increment `available_copies`).

---

## Key non-obvious decisions

**Last-copy guard is synchronous, not event-driven.**
Postgres row lock via `UPDATE books SET available_copies = available_copies - 1 WHERE id = :id AND available_copies > 0`. Redis SET NX is only a pre-filter. Kafka BookRented is fan-out — inventory does NOT re-decrement on it.

**JSON Schema: no `format` keywords.**
Confluent registry's JSON validator rejects `format: 'uuid'`/`'date-time'`. All schemas use `{ type: 'string', minLength: 1 }`. Schema registration uses the registry REST API directly — the kafkajs client's `register()` mishandles new JSON subjects.

**`"webpack": true` in `nest-cli.json` is required.**
Without it, TypeScript output nests as `dist/apps/auth-service/apps/auth-service/src/main.js` and `@app/*` aliases break at runtime.

**Transactional outbox everywhere.**
Event written in same DB transaction as the state change. Relay polls with `FOR UPDATE SKIP LOCKED`. Never "commit then publish".

**Idempotent consumers: `processed_events` table.**
`INSERT INTO processed_events (event_id, event_type) ... ON CONFLICT DO NOTHING` in the same transaction as the side effect. Zero-overhead dedupe.

**Rotating refresh tokens.**
Stored as `<UUID>.<hex-32>` in Redis; only SHA-256 of secret is persisted. Single-use (deleted on rotation). Access token denylist: `denylist:jti:<jti>` in Redis with TTL = remaining token lifetime.

**React StrictMode + single-use refresh tokens.**
Bootstrap uses a `ref` guard (`bootstrapped.current`), NOT an `active`/cleanup pattern. Cleanup set `active = false` on the first effect teardown, stranding the refresh promise → loading spinner forever.

**pnpm in Docker: single-stage Dockerfile.**
Multi-stage `COPY --from` breaks pnpm's virtual-store symlinks. Use one stage: install with `pnpm install --frozen-lockfile`, then `nest build ${SERVICE}`, then `cp dist/apps/${SERVICE}/main.js dist/main.js`.

**Catalog FTS: tsvector GENERATED ALWAYS AS STORED + GIN index.**
TypeORM `synchronize` creates the column but can't emit GIN DDL. `CatalogSetupService.onModuleInit()` runs `CREATE INDEX IF NOT EXISTS ... USING GIN` on every boot (idempotent, fast after first run).

---

## Important file landmarks

| File | What's there |
|---|---|
| `libs/contracts/src/` | All event types, JSON Schemas, topic names — single source of truth for the event contract |
| `libs/common/src/` | Shared modules: Redis, Kafka+SchemaRegistry, JWT validator (JWKS), auth guards, correlation ID header constant |
| `apps/auth-service/src/auth/token.service.ts` | RS256 JWT issue, refresh token rotation, revocation |
| `apps/inventory-service/src/inventory.service.ts` | `reserve()` (last-copy guard), `applyReturn()` (idempotent), `createBookFromEvent()` |
| `apps/rental-service/src/rentals.service.ts` | `rent()` with Redis gate → reserve → outbox; `returnBook()` |
| `apps/rental-service/src/outbox/relay.service.ts` | Canonical outbox relay — copy this pattern for any new outbox producer |
| `apps/catalog-service/src/catalog.service.ts` | `createBook()` with outbox, Redis cache-aside (`catalog:book:<id>` 5 min, `catalog:books:list` 60 s), FTS search |
| `apps/catalog-service/src/catalog-setup.service.ts` | GIN index bootstrap on startup |
| `apps/inventory-service/test/last-copy.int-spec.ts` | Milestone: 50 concurrent reservers, exactly 1 wins |
| `apps/catalog-service/test/catalog.int-spec.ts` | FTS correctness + outbox-in-same-tx test |
| `web-frontend/src/api/client.ts` | Access token in module variable, single-flight refresh (one `Promise` shared across concurrent 401s) |
| `web-frontend/src/auth/AuthContext.tsx` | Bootstrap with `bootstrapped.current` ref guard |
| `Dockerfile` | Shared NestJS Dockerfile — `ARG SERVICE` selects which app to build |
| `web-frontend/Dockerfile` | Vite build + nginx multi-stage |
| `web-frontend/nginx.conf` | Proxy `/api` → `http://api-gateway:3000`; SPA fallback to `index.html` |
| `docker-compose.yml` | Full stack: all services + `keys-init` + kafka-ui + RedisInsight |

---

## Open gaps (Slice 3 starting point)

- **Overdue detection:** no job marks ACTIVE rentals past `dueAt` as OVERDUE yet.
- **Notification-service:** nothing consumes BookRented/BookReturned/BookOverdue to send emails.
- **Catalog ↔ inventory merge:** `BookDetailPage` shows inventory availability but not catalog rich data (isbn, description, genre). Catalog doesn't know `availableCopies` — needs either a cross-service call or catalog subscribing to BookRented/BookReturned to maintain its own counter.
- **Seed migration:** the 3 dev-seeded books are inserted directly into inventory's DB. They don't exist in catalog-service, so catalog FTS and `GET /api/catalog/books` won't return them. To fix: move seeding to catalog-service so it flows through the BookCreated event.
- **Pagination:** book list has no pagination.
- **Real RSA key management:** keys are auto-generated into a Docker named volume (`jwt-keys-data`). In prod, these should come from a secrets manager (AWS Secrets Manager, Vault).
