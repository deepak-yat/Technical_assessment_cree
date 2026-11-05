# Multi-stage production Dockerfile for Hotel Reservation API
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace and server manifests
COPY package.json package-lock.json ./
COPY server/package.json ./server/

RUN npm ci --workspace=server

# Copy server source and build
COPY server/ ./server/
RUN npm run build --workspace=server

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY server/package.json ./server/

RUN npm ci --workspace=server --omit=dev

COPY --from=builder /app/server/dist ./server/dist

EXPOSE 5000

CMD ["node", "server/dist/server.js"]
