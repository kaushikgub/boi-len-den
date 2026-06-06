# boi-len-den

A book rental platform built as NestJS microservices. Monorepo: backend services in
`apps/`, shared libraries in `libs/`, the React frontend as a separate workspace in
`web-frontend/`.

## Architecture (Slice 1)

| Component          | Role                                                                 |
| ------------------ | ------------------------------------------------------------------- |
| `api-gateway`      | Public entry point. Validates JWT, rate-limits, routes. No business logic. |
| `auth-service`     | Owns users/credentials. Issues RS256 access + rotating refresh tokens. |
| `rental-service`   | Rental lifecycle (RESERVED → ACTIVE → RETURNED). Owns the outbox.   |
| `inventory-service`| Source of truth for copies & availability. Atomic reservations.     |
| `web-frontend`     | React + MUI SPA. Talks only to the gateway.                         |

**Key design decisions** (see git history / the plan):
- **Last-copy race**: rental-service calls inventory-service *synchronously* to reserve a
  copy via an atomic conditional `UPDATE`. Inventory creates a reservation row (decrement +
  TTL); rental confirms it, or a sweeper releases it. Redis `SET NX` is a fast optimistic
  gate in front, never the source of truth. Kafka `BookRented` is fan-out only.
- **Events**: JSON Schema in the Confluent Schema Registry. Contracts in `libs/contracts`.
- **Outbox**: domain events written in the same DB transaction as the state change, relayed
  to Kafka by a polling relay (not Debezium, for Slice 1).
- **Build**: NestJS monorepo with webpack bundling — each app emits a self-contained
  `dist/apps/<app>/main.js`.

## Prerequisites

- Node ≥ 20, pnpm 9 (`npm i -g pnpm@9`)
- Docker Desktop (running)

## Setup

```bash
pnpm install
cp .env.example .env
```

## Run the infrastructure (Slice 1)

> Docker Desktop must be running.

```bash
pnpm infra:up      # 3x Postgres, Redis, Kafka (KRaft), Schema Registry, topic init
docker compose ps  # everything should be healthy; kafka-init exits 0
```

Tear down (including volumes): `pnpm infra:down`.

## Run the frontend

```bash
# backend services must be running (see below), then:
pnpm --filter web-frontend dev    # http://localhost:5173
```

The Vite dev server proxies `/api` to the gateway, so the browser is same-origin —
the HttpOnly refresh cookie and silent token refresh work without CORS. Pages: login,
catalog browse, book detail + Rent, and "My Rentals" + Return. The access token lives
only in memory; the refresh cookie restores the session on reload.

## Build & run the services

```bash
pnpm build:all                 # bundle all four apps
pnpm start:gateway             # :3000   (also start:auth :3001, start:rental :3002, start:inventory :3003)
```

## Verify (Slice 1, step 1)

```bash
# 1. Infra healthy
docker compose ps

# 2. Topics exist
docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list
#   → book-rented, book-returned

# 3. Schema Registry reachable
curl -s localhost:8081/subjects        # → []  (no schemas registered yet)

# 4. A service boots and is healthy, with correlation-id propagation
pnpm build:all && PORT=3000 node dist/apps/api-gateway/main.js &
curl -i localhost:3000/health          # → {"status":"ok",...} + x-correlation-id header
```

## Testing

```bash
pnpm test          # hermetic unit tests (no infra needed)
pnpm test:int      # integration tests — requires `pnpm infra:up` first.
                   # Includes the milestone: 50 concurrent reservers on the last
                   # copy -> exactly one wins, availability never goes negative.
```

## Generate JWT signing keys (needed from Step 2)

```bash
mkdir -p keys
openssl genpkey -algorithm RSA -out keys/jwt-private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -in keys/jwt-private.pem -pubout -out keys/jwt-public.pem
```

`keys/` and `.env` are gitignored.
