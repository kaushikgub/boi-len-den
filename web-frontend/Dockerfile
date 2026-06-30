# Build context is the monorepo root (docker-compose sets context: .)
# so we can reach pnpm-workspace.yaml and the shared pnpm-lock.yaml.

FROM node:24-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@9

# Install only web-frontend deps (pnpm filters on the workspace package name)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY web-frontend/package.json web-frontend/
RUN pnpm install --frozen-lockfile --filter web-frontend...

# Build
COPY web-frontend/ web-frontend/
RUN pnpm --filter web-frontend build

# ---- Serve with nginx ----
FROM nginx:alpine
COPY --from=builder /app/web-frontend/dist /usr/share/nginx/html
COPY web-frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
