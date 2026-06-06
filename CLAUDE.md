# boi-len-den — Claude context

Book rental platform built as NestJS microservices. Read this before touching anything.

---

## Full build plan & status

### Slice 1 — rent & return ✅ DONE

| Step | What | Status |
|---|---|---|
| 1 | Monorepo scaffold: pnpm workspace, NestJS apps skeleton, docker-compose infra (Postgres×3, Redis, Kafka KRaft, Schema Registry) | ✅ |
| 2 | auth-service: RS256 JWT, rotating refresh tokens (Redis), JWKS endpoint, rate-limit middleware, admin seed | ✅ |
| 3 | api-gateway: proxy + JWT auth middleware + rate-limit (Redis fixed-window) + correlation ID injection | ✅ |
| 4 | inventory-service: Book entity, atomic conditional decrement (last-copy guard), reservation holds + TTL sweeper | ✅ |
| 5 | rental-service: rent (Redis gate → reserve → DB tx + outbox), return, transactional outbox relay | ✅ |
| 6 | Integration test milestone: 50 concurrent reservers on a 1-copy book → exactly 1 wins, 49 ConflictException | ✅ |
| 7 | web-frontend: React SPA, login/register, catalog browse, book detail + rent, my-rentals + return, admin add-book | ✅ |
| — | Bug fixes: StrictMode loading-spinner (ref guard), webpack: true, schema-registry format keywords | ✅ |
| — | UI redesign: Modern SaaS — sidebar nav, gradient book covers, skeleton loaders, split-screen login | ✅ |

### Slice 2 — catalog-service + cache + search + Docker ✅ DONE

| Step | What | Status |
|---|---|---|
| 1+2 | catalog-service scaffold (port 3004, postgres-catalog :5436) + BookCreated event contract + inventory consumer (idempotent ON CONFLICT DO NOTHING) | ✅ |
| 3 | Admin form switched to POST /api/catalog/books; optional rich fields (isbn, description, genre, coverUrl, publishedYear); createBook triggers BookCreated → inventory via Kafka | ✅ |
| 4 | Redis cache-aside in catalog-service: `catalog:book:<id>` TTL 5 min, `catalog:books:list` TTL 60 s, list invalidated on write | ✅ |
| 5 | Postgres FTS: `tsvector GENERATED ALWAYS AS STORED` on (title ∥ author), GIN index via `CatalogSetupService.onModuleInit()`, `plainto_tsquery` + `ts_rank` ordering | ✅ |
| 6+7 | Frontend: `useDeferredValue` search; 5 integration tests (FTS correctness, outbox-in-same-tx) | ✅ |
| — | kafka-ui (:8080) + RedisInsight (:8001) added to docker-compose | ✅ |
| — | Full Docker Compose stack: Dockerfile (ARG SERVICE), web-frontend/Dockerfile (Vite + nginx), keys-init one-shot (openssl RSA keygen), all services containerised with healthchecks | ✅ |

### Slice 3 — overdue detection + notification-service 🔲 NEXT

Planned steps (not started):

| Step | What |
|---|---|
| 1 | `OverdueJob` in rental-service: `@Cron` every hour, query ACTIVE rentals where `dueAt < NOW()`, update status → OVERDUE, publish `BookOverdue` event via outbox |
| 2 | `BookOverdue` event contract in `libs/contracts` (envelope + JSON Schema + topic `book-overdue`) |
| 3 | New `notification-service` (port 3005, postgres-notification :5437): subscribes to `book-rented`, `book-returned`, `book-overdue`; sends emails via nodemailer (dev: Mailpit/MailHog SMTP trap) |
| 4 | Notification dedup: `processed_events` table (same pattern as inventory-service) — redelivered event must not send duplicate email |
| 5 | Add Mailpit to docker-compose (:8025 web UI, :1025 SMTP); wire `SMTP_HOST`/`SMTP_PORT` env var to notification-service |
| 6 | Frontend: "OVERDUE" status chip already exists in `StatusChip`; add overdue banner on MyRentalsPage |
| 7 | Integration tests: overdue job marks correct rentals; notification consumer dedupes correctly |

### Slice 4 — payment-service (idempotent charges) 🔲 PENDING

Planned steps:

| Step | What |
|---|---|
| 1 | `payment-service` (port 3006, postgres-payment :5438): mock charge on rent (fixed fee), mock refund on return |
| 2 | `PaymentCharged` / `PaymentRefunded` event contracts |
| 3 | rental-service subscribes to `PaymentCharged` to confirm the rental (or cancel if payment fails within TTL) — introduces a saga: reserve → charge → confirm or rollback |
| 4 | Idempotent charge: `payments` table with `rental_id` unique constraint; duplicate charge request is a no-op |
| 5 | Payment history page in frontend |
| 6 | Stripe integration (optional — swap mock for real Stripe webhook handler) |

### Slice 5 — Kubernetes + Helm 🔲 PENDING

Planned steps:

| Step | What |
|---|---|
| 1 | Helm chart skeleton: one chart per service, shared `values.yaml` for image tags and env |
| 2 | Kubernetes manifests: Deployment, Service, ConfigMap, Secret (RSA keys from K8s Secret or external-secrets) |
| 3 | Ingress (nginx ingress controller): route `/api` → gateway, `/` → frontend |
| 4 | Horizontal pod autoscaling for gateway and rental-service |
| 5 | Health probes wired to existing `/health` endpoints |
| 6 | CI: GitHub Actions — lint + test + build Docker images + push to registry + helm upgrade |

---

## Open gaps (known before Slice 3 starts)

- **Overdue detection:** no job marks ACTIVE rentals past `dueAt` as OVERDUE. (Slice 3 Step 1)
- **Notifications:** nothing reacts to BookRented/BookReturned/BookOverdue to send emails. (Slice 3 Step 3)
- **Catalog ↔ inventory merge:** `BookDetailPage` shows inventory availability but not catalog rich data (isbn, description, genre). Catalog doesn't track `availableCopies` — fix options: (a) catalog subscribes to BookRented/BookReturned to maintain its own counter, or (b) gateway aggregates both calls.
- **Seed migration:** the 3 dev-seeded books live only in inventory's DB, not in catalog. Catalog FTS and `GET /api/catalog/books` won't return them. Fix: move `SeedService` to catalog-service so seeding flows through the BookCreated event.
- **Pagination:** book list has no pagination.
- **RSA key management in prod:** keys are auto-generated into a Docker named volume (`jwt-keys-data`). For prod/K8s use AWS Secrets Manager or Vault. (Slice 5)

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
pnpm stack:up            # docker compose up -d --build  (first boot auto-generates RSA keys)
pnpm stack:down          # stop, keep volumes
pnpm stack:down:clean    # stop + wipe all volumes (full reset)
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

| Topic | Partitions | Producer | Consumers |
|---|---|---|---|
| `book-created` | 6 | catalog-service (outbox relay) | inventory-service |
| `book-rented` | 6 | rental-service (outbox relay) | inventory-service |
| `book-returned` | 6 | rental-service (outbox relay) | inventory-service |

**BookCreated:** Admin `POST /api/catalog/books` → catalog writes Book + outbox row (same tx) → relay → inventory creates its own Book record (`ON CONFLICT DO NOTHING` on PK = idempotent).

**Rent:** Redis SET NX (fast gate) → `inventory.reserve()` (atomic `UPDATE WHERE available_copies > 0`, Postgres row lock = real last-copy guard) → rental DB tx + outbox row → relay → inventory confirms reservation (no count change — already decremented synchronously).

**Return:** `POST /api/rentals/:id/return` → rental tx + outbox → relay → inventory `applyReturn()` (dedupe by eventId in `processed_events`, then increment `available_copies`).

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
| `apps/inventory-service/src/inventory.service.ts` | `reserve()` (last-copy guard), `applyReturn()` (idempotent), `createBookFromEvent()` |
| `apps/rental-service/src/rentals.service.ts` | `rent()` — Redis gate → reserve → DB tx + outbox; `returnBook()` |
| `apps/rental-service/src/outbox/relay.service.ts` | **Canonical outbox relay pattern** — copy this for any new outbox producer |
| `apps/catalog-service/src/catalog.service.ts` | `createBook()` with outbox, Redis cache-aside, FTS search |
| `apps/catalog-service/src/catalog-setup.service.ts` | GIN index bootstrap on startup |
| `apps/inventory-service/test/last-copy.int-spec.ts` | Milestone: 50 concurrent reservers, exactly 1 wins |
| `apps/catalog-service/test/catalog.int-spec.ts` | FTS correctness + outbox-in-same-tx tests |
| `web-frontend/src/api/client.ts` | Access token in module variable, single-flight refresh across concurrent 401s |
| `web-frontend/src/auth/AuthContext.tsx` | Bootstrap with `bootstrapped.current` ref guard |
| `Dockerfile` | Shared NestJS Dockerfile — `ARG SERVICE` selects which app |
| `web-frontend/Dockerfile` | Vite build + nginx multi-stage |
| `web-frontend/nginx.conf` | Proxy `/api` → `http://api-gateway:3000`; SPA fallback to `index.html` |
| `docker-compose.yml` | Full stack: all services + `keys-init` + kafka-ui + RedisInsight |
