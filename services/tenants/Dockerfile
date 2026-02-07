FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared ./packages/shared
COPY services/tenants/package.json ./services/tenants/
RUN npm install -w @realestate/shared -w @realestate/tenants-service

COPY packages/shared ./packages/shared
COPY services/tenants ./services/tenants
RUN npm run build -w @realestate/shared && npm run build -w @realestate/tenants-service

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/tenants/dist ./services/tenants/dist
COPY --from=builder /app/services/tenants/package.json ./services/tenants/
COPY --from=builder /app/services/tenants/src/openapi.yaml ./services/tenants/dist/
COPY --from=builder /app/package.json ./

WORKDIR /app/services/tenants
EXPOSE 5003
CMD ["node", "dist/index.js"]
