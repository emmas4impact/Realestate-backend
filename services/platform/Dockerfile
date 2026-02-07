# Platform service - centralized Swagger UI (no DB)
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY services/platform/package.json ./services/platform/
RUN npm install -w @realestate/platform --ignore-scripts

COPY services/platform ./services/platform
RUN npm run build -w @realestate/platform

FROM node:22-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/platform/dist ./services/platform/dist
COPY --from=builder /app/services/platform/package.json ./services/platform/
COPY --from=builder /app/package.json ./

# Copy OpenAPI specs from context (built in same repo)
COPY services/listings/src/openapi.yaml ./services/platform/dist/specs/listings/
COPY services/users/src/openapi.yaml ./services/platform/dist/specs/users/
COPY services/tenants/src/openapi.yaml ./services/platform/dist/specs/tenants/
COPY services/property/openapi.yaml ./services/platform/dist/specs/property/
COPY services/inventory/openapi.yaml ./services/platform/dist/specs/inventory/
COPY services/price/openapi.yaml ./services/platform/dist/specs/price/

WORKDIR /app/services/platform
EXPOSE 5010
ENV PORT=5010
CMD ["node", "dist/index.js"]
