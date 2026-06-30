# Shared Dockerfile for all NestJS services.
# Build with:  docker build --build-arg SERVICE=auth-service -t boi-auth .
# In compose:  build: { context: ., args: { SERVICE: auth-service } }
#
# Single stage keeps things simple — pnpm's virtual-store symlinks break in
# multi-stage COPY, and image size is not a concern for this dev stack.

FROM node:24-alpine
WORKDIR /app

RUN npm install -g pnpm@9

# ---- Install deps (layer-cached until manifests change) ----
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
# web-frontend is a workspace package; pnpm needs its package.json present
# even though we never build the frontend here.
COPY web-frontend/package.json web-frontend/package.json

RUN pnpm install --frozen-lockfile

# ---- Build the target service ----
COPY tsconfig.json nest-cli.json ./
COPY libs/ libs/
COPY apps/ apps/

ARG SERVICE
RUN pnpm exec nest build ${SERVICE} && \
    cp dist/apps/${SERVICE}/main.js dist/main.js

# ---- Runtime ----
ENV NODE_ENV=development
EXPOSE 3000
CMD ["node", "dist/main.js"]
