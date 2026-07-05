# Search service
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared ./packages/shared
COPY services/search/package.json ./services/search/

RUN npm install -w @realestate/shared -w @realestate/search-service --ignore-scripts

COPY packages/shared ./packages/shared
COPY services/search ./services/search

RUN npm run build -w @realestate/shared && npm run build -w @realestate/search-service

FROM node:22-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/search/dist ./services/search/dist
COPY --from=builder /app/services/search/package.json ./services/search/
COPY --from=builder /app/services/search/openapi.yaml ./services/search/dist/
COPY --from=builder /app/services/search/openapi.yaml ./services/search/
COPY --from=builder /app/package.json ./

WORKDIR /app/services/search
EXPOSE 5007
CMD ["node", "dist/index.js"]
