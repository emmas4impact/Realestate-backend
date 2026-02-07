FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared ./packages/shared
COPY services/inventory/package.json ./services/inventory/
RUN npm install -w @realestate/shared -w @realestate/inventory-service --ignore-scripts
COPY packages/shared ./packages/shared
COPY services/inventory ./services/inventory
RUN npm run build -w @realestate/shared && npm run build -w @realestate/inventory-service

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/inventory/dist ./services/inventory/dist
COPY --from=builder /app/services/inventory/package.json ./services/inventory/
COPY --from=builder /app/services/inventory/openapi.yaml ./services/inventory/dist/
COPY --from=builder /app/services/inventory/openapi.yaml ./services/inventory/
COPY --from=builder /app/services/inventory/drizzle ./services/inventory/drizzle
COPY --from=builder /app/package.json ./
WORKDIR /app/services/inventory
EXPOSE 5005
CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
