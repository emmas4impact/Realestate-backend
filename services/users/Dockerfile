FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared ./packages/shared
COPY services/users/package.json ./services/users/
RUN npm install -w @realestate/shared -w @realestate/users-service --ignore-scripts

COPY packages/shared ./packages/shared
COPY services/users ./services/users
RUN npm run build -w @realestate/shared && npm run build -w @realestate/users-service

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/users/dist ./services/users/dist
COPY --from=builder /app/services/users/package.json ./services/users/
COPY --from=builder /app/services/users/src/openapi.yaml ./services/users/dist/
COPY --from=builder /app/services/users/src/openapi.yaml ./services/users/
COPY --from=builder /app/package.json ./

WORKDIR /app/services/users
EXPOSE 5002
CMD ["node", "dist/index.js"]
