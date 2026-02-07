# Property service
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared ./packages/shared
COPY services/property/package.json ./services/property/

RUN npm install -w @realestate/shared -w @realestate/property-service --ignore-scripts

COPY packages/shared ./packages/shared
COPY services/property ./services/property

RUN npm run build -w @realestate/shared && npm run build -w @realestate/property-service

FROM node:22-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/property/dist ./services/property/dist
COPY --from=builder /app/services/property/package.json ./services/property/
COPY --from=builder /app/services/property/openapi.yaml ./services/property/dist/
COPY --from=builder /app/services/property/openapi.yaml ./services/property/
COPY --from=builder /app/services/property/drizzle ./services/property/drizzle
COPY --from=builder /app/package.json ./

WORKDIR /app/services/property
EXPOSE 5004
CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
