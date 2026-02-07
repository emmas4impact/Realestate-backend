# --- Stage 1: Build Stage ---
FROM node:22-alpine3.18 AS builder

WORKDIR /app

COPY package.json ./
RUN npm install 

# Copy rest of the app files
COPY public ./public
COPY src ./src
COPY test/listings.test.mjs ./
COPY test/tenants.test.mjs ./
COPY test/users.test.mjs ./

# ----- Stage 2: Runtime Stage -----
FROM node:22-alpine3.18 AS runtime 

# Set working directory
WORKDIR /app

# Copy only necessary artifacts from the build stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src

EXPOSE 5005
CMD ["node", "src/index.mjs"]
