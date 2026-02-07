FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared ./packages/shared
COPY services/price/package.json ./services/price/
RUN npm install -w @realestate/shared -w @realestate/price-service --ignore-scripts
COPY packages/shared ./packages/shared
COPY services/price ./services/price
RUN npm run build -w @realestate/shared && npm run build -w @realestate/price-service

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/price/dist ./services/price/dist
COPY --from=builder /app/services/price/package.json ./services/price/
COPY --from=builder /app/services/price/openapi.yaml ./services/price/dist/
COPY --from=builder /app/services/price/openapi.yaml ./services/price/
COPY --from=builder /app/services/price/drizzle ./services/price/drizzle
COPY --from=builder /app/package.json ./
WORKDIR /app/services/price
EXPOSE 5006
CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
