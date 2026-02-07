# Listings service - one image per API
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace root for shared package
COPY package.json package-lock.json* ./
COPY packages/shared ./packages/shared
COPY services/listings/package.json ./services/listings/

RUN npm install -w @realestate/shared -w @realestate/listings-service --ignore-scripts

COPY packages/shared ./packages/shared
COPY services/listings ./services/listings

RUN npm run build -w @realestate/shared && npm run build -w @realestate/listings-service

FROM node:22-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/listings/dist ./services/listings/dist
COPY --from=builder /app/services/listings/package.json ./services/listings/
COPY --from=builder /app/services/listings/src/openapi.yaml ./services/listings/dist/
COPY --from=builder /app/services/listings/drizzle ./services/listings/drizzle
COPY --from=builder /app/package.json ./

WORKDIR /app/services/listings
EXPOSE 5001
CMD ["sh", "-c", "node dist/migrate.js && exec node dist/index.js"]
