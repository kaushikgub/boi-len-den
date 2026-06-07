# boi-len-den

A book rental platform built as **NestJS microservices** — monorepo with independent
PostgreSQL databases, Kafka event bus, Redis cache/gate, and a React SPA frontend.

---

## Services

| Service | Port | Database | Responsibility |
|---|---|---|---|
| `api-gateway` | 3000 | — | Public entry point. Validates JWT, enforces rate limits, proxies to downstream services. No business logic. |
| `auth-service` | 3001 | postgres-auth :5433 | User accounts, RS256 JWT issuance, rotating refresh tokens (stored in Redis), JWKS endpoint for other services to validate tokens without shared secrets. |
| `rental-service` | 3002 | postgres-rental :5434 | Rental lifecycle: `RESERVED → ACTIVE → RETURNED / OVERDUE`. Writes transactional outbox events. Runs the hourly overdue-detection cron job. |
| `inventory-service` | 3003 | postgres-inventory :5435 | Source of truth for `available_copies`. Atomic last-copy guard via `UPDATE … WHERE available_copies > 0`. Consumes `book-rented` / `book-returned` / `book-created` from Kafka. |
| `catalog-service` | 3004 | postgres-catalog :5436 | Book metadata (title, author, ISBN, genre, description, cover). Full-text search via Postgres `tsvector` GIN index. Redis cache-aside (5 min per-book, 60 s list). Publishes `BookCreated` outbox events. |
| `payment-service` | 3006 | postgres-payment :5438 | Mock charge ($5 fixed fee) on rent, mock refund on return. Idempotent via `UNIQUE(rental_id)`. Publishes `PaymentCharged` / `PaymentRefunded` events. |
| `notification-service` | 3005 | postgres-notification :5437 | Sends emails for `book-rented`, `book-returned`, `book-overdue` events. Deduplicates redelivered events via `processed_events` table. Uses nodemailer (Mailpit SMTP trap in dev). |
| `web-frontend` | 5173 (dev) / 80 (Docker) | — | React SPA. Vite dev server in development, nginx in Docker. Talks only to `api-gateway`. |

### Dev-only UIs

| Tool | URL | Purpose |
|---|---|---|
| kafka-ui | http://localhost:8080 | Browse topics, messages, consumer groups, Schema Registry |
| RedisInsight | http://localhost:8001 | Inspect reservation gates, denylist, cache keys |
| Mailpit | http://localhost:8025 | Catch all outgoing emails |

---

## Technology stack

| Layer | Technology | Why |
|---|---|---|
| Services | NestJS (Node 20) | Structured DI, decorators, great Kafka/TypeORM ecosystem |
| Language | TypeScript | End-to-end type safety across service boundaries |
| Build | pnpm workspaces + NestJS webpack bundler | Single-stage Docker image; pnpm virtual-store symlinks require single stage |
| Transport | Apache Kafka (KRaft, no ZooKeeper) | Durable, ordered, fan-out event bus; Schema Registry enforces event contracts |
| Event contracts | JSON Schema in Confluent Schema Registry | Schema validation at the broker; no `format` keywords (registry rejects them) |
| Databases | PostgreSQL 16 (one per service) | Physical isolation; cross-service DB access is physically impossible |
| ORM | TypeORM | Entity-driven migrations, easy with NestJS |
| Cache / gate | Redis 7 | Reservation pre-filter (`SET NX`), auth token denylist, rate-limit counters, catalog cache |
| Auth | RS256 JWT (private key signs, public JWKS validates) | Services can verify tokens independently; no shared secret |
| Frontend | React 18 + TanStack Query + React Router | SPA with server-state caching and optimistic updates |
| Frontend build | Vite | Fast HMR in dev; nginx serves the static build in Docker |
| Monorepo | pnpm workspaces | Shared `libs/` without publishing; single `pnpm install` |

---

## Event flow

```
Admin POST /api/catalog/books
  → catalog-service writes Book + outbox row (same Postgres tx)
  → outbox relay publishes BookCreated → Kafka [book-created]
  → inventory-service consumes → creates its own Book row (ON CONFLICT DO NOTHING)

User POST /api/rentals
  → Redis SET NX (fast gate — optimistic pre-filter)
  → inventory-service.reserve() — atomic UPDATE WHERE available_copies > 0 (real guard)
  → rental-service writes RESERVED rental + outbox (same tx)
  → outbox relay publishes BookRented → Kafka [book-rented]
  → payment-service consumes → charges $5, publishes PaymentCharged
  → rental-service consumes PaymentCharged → RESERVED → ACTIVE
  → notification-service consumes book-rented → sends "Your rental is confirmed" email
  → inventory-service consumes book-rented (fan-out only — copy already decremented)

User POST /api/rentals/:id/return
  → rental-service writes RETURNED + outbox (same tx)
  → outbox relay publishes BookReturned → Kafka [book-returned]
  → inventory-service consumes → increments available_copies (idempotent via processed_events)
  → payment-service consumes → refunds, publishes PaymentRefunded
  → notification-service consumes book-returned → sends "Return confirmed" email

Cron every hour (rental-service)
  → marks ACTIVE rentals past dueAt as OVERDUE, publishes BookOverdue
  → notification-service consumes book-overdue → sends overdue warning email
```

---

## Key design decisions

**Last-copy guard is synchronous Postgres — not Kafka.**
`UPDATE books SET available_copies = available_copies - 1 WHERE id = :id AND available_copies > 0`. Redis `SET NX` is a fast pre-filter only. `BookRented` on Kafka is fan-out; inventory does NOT re-decrement on it.

**Transactional outbox everywhere.**
Every event is written in the same DB transaction as the state change. A polling relay publishes to Kafka. Never "commit state, then publish" — that loses events on crash.

**Idempotent consumers via `processed_events`.**
`INSERT … ON CONFLICT DO NOTHING` on `(event_id, event_type)` in the same transaction as the side effect. Zero-overhead dedup; redelivered events are safe.

**Rotating refresh tokens.**
Stored as `<UUID>.<hex-32>` in Redis; only SHA-256 of the secret is persisted. Single-use: deleted on use (rotation). Revocation via `denylist:jti:<jti>` key with TTL = remaining access token lifetime.

**JSON Schema: no `format` keywords.**
Confluent Registry's JSON validator rejects `format: "uuid"` / `"date-time"`. All schemas use `{ type: "string", minLength: 1 }`.

**`"webpack": true` in `nest-cli.json` is required.**
Without it, TypeScript output nests as `dist/apps/auth-service/apps/auth-service/src/main.js` and `@app/*` path aliases break at runtime.

---

## Prerequisites

- **Node ≥ 20** and **pnpm 9** — `npm i -g pnpm@9`
- **Docker Desktop** running

---

## Running the stack

### Option A — Full Docker (recommended for first run)

Everything runs in containers; no local services needed.

```bash
pnpm stack:up          # docker compose up -d --build
                       # First boot auto-generates RSA JWT keys into a named volume.
docker compose ps      # all services + infra should reach healthy
```

| URL | What |
|---|---|
| http://localhost:5173 | Web frontend |
| http://localhost:3000 | API gateway |
| http://localhost:8080 | kafka-ui |
| http://localhost:8025 | Mailpit (emails) |
| http://localhost:8001 | RedisInsight |

```bash
pnpm stack:down        # stop, keep volumes (data survives)
pnpm stack:down:clean  # stop + wipe all volumes (full reset)
```

---

### Option B — Host dev mode (hot-reload)

Infra in Docker, services run on the host with `ts-node` / NestJS watch mode.

**Step 1 — Start infrastructure**

```bash
pnpm infra:up
# Starts: Postgres ×5, Redis, Kafka (KRaft), Schema Registry, Mailpit, kafka-init, RedisInsight
docker compose ps   # kafka-init should exit 0; everything else healthy
```

**Step 2 — Configure environment**

```bash
cp .env.example .env
# Edit .env if you need non-default values (defaults work out of the box)
```

**Step 3 — Generate JWT keys (first time only)**

```bash
mkdir -p keys
openssl genrsa -out keys/jwt-private.pem 2048
openssl rsa -in keys/jwt-private.pem -pubout -out keys/jwt-public.pem
```

`keys/` is gitignored and never committed.

**Step 4 — Start each service** (separate terminals or use a process manager)

```bash
pnpm start:auth          # auth-service      → http://localhost:3001
pnpm start:inventory     # inventory-service → http://localhost:3003
pnpm start:catalog       # catalog-service   → http://localhost:3004
pnpm start:rental        # rental-service    → http://localhost:3002
pnpm start:payment       # payment-service   → http://localhost:3006
pnpm start:notification  # notification-service → http://localhost:3005
pnpm start:gateway       # api-gateway       → http://localhost:3000
```

Start order matters: auth → inventory + catalog → rental + payment + notification → gateway.

**Step 5 — Start the frontend**

```bash
cd web-frontend
pnpm dev                 # http://localhost:5173
```

Vite proxies `/api` to the gateway — the HttpOnly refresh cookie and silent token
refresh work without any CORS config.

---

## Dev credentials

| Role | Email | Password |
|---|---|---|
| Member | `reader@example.com` | `supersecret` |
| Admin / Librarian | `admin@boi-len-den.local` | `admin12345` |

---

## Testing

```bash
pnpm test          # hermetic unit tests (no infra needed)
pnpm test:int      # integration tests — run `pnpm infra:up` first
```

Notable integration tests:
- **Last-copy milestone**: 50 concurrent reservers on a 1-copy book → exactly 1 wins, 49 `ConflictException`.
- **Catalog FTS**: full-text search correctness + outbox written in same transaction.
- **Notification dedup**: redelivered events do not send duplicate emails.

---

## Project layout

```
apps/
  api-gateway/          # NestJS HTTP proxy
  auth-service/         # JWT + users
  catalog-service/      # Book metadata, search, cache
  inventory-service/    # Copy counts, reservation holds
  notification-service/ # Email dispatch
  payment-service/      # Charge / refund
  rental-service/       # Rental lifecycle
libs/
  common/               # Shared: Redis, Kafka+SchemaRegistry client, JWT guard, correlation ID
  contracts/            # Event types, JSON Schemas, Kafka topic names
web-frontend/           # React SPA (Vite + TanStack Query)
Dockerfile              # Shared NestJS image — ARG SERVICE selects the app
docker-compose.yml      # Full stack (infra + all services + UIs)
```
