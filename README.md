# Real Estate Backend

TypeScript microservices for real estate: listings, users/auth, tenants, properties, inventory, and pricing. Each API runs as its own service with OpenAPI docs; a single Docker Compose stack runs everything. Optional Caddy gateway exposes one entrypoint; the platform service serves a combined Swagger UI for all APIs.

## Stack

| Layer      | Tech                |
|-----------|----------------------|
| Runtime   | Node 20+             |
| Language  | TypeScript           |
| Framework | Express              |
| Database  | PostgreSQL 16       |
| ORM       | Drizzle              |
| Containers| One image per service|

## Standards

- **OpenAPI (Swagger)** – Each service exposes `/api-docs` and `/openapi.json`.
- **RESO-aligned** – Listings use RESO-style fields (status, price, geographic metadata).
- **REST** – Consistent HTTP methods, status codes, and pagination (`page`, `limit`, `meta`).
- **Auth** – Users: JWT access + refresh tokens. Listings, tenants, property, inventory, price: optional `bg-api-key` header.

## Services

| Service   | Port | Description |
|-----------|------|-------------|
| Listings  | 5001 | Property listings; linked to **property** (availability) and **price** (rent/sales). Minimal create: `propertyId` + `listingType` (rent \| sales). |
| Users     | 5002 | Registration, login, JWT access/refresh, cookie support. |
| Tenants   | 5003 | Tenants/applicants; can reference listings. |
| Property  | 5004 | Physical assets; returns `inventory[]`, `prices[]`, `availability`. |
| Inventory | 5005 | Units/quantity per property; `availableQuantity`, decrement on rent/sale. |
| Price     | 5006 | Prices per property by type (sale, rent). |
| Platform  | 5010 | Combined Swagger UI merging all services’ OpenAPI specs. |

Listings can only be created for **available** properties; price is taken from the price service by `listingType`. Property `availability` is derived from inventory (true when any unit has `availableQuantity > 0`).

## Project layout

```
├── docker-compose.yml   # postgres + all 7 services (+ optional Caddy)
├── Caddyfile            # Optional gateway (profile: gateway)
├── .env.example
├── package.json         # Workspace root
├── packages/
│   └── shared/          # Pagination, constants, shared types
└── services/
    ├── listings/        # Listings API (property + price integration, geocoding)
    ├── users/           # Auth & users (JWT, bcryptjs)
    ├── tenants/         # Tenants API
    ├── property/        # Properties (inventory + price aggregation)
    ├── inventory/       # Inventory/units per property
    ├── price/           # Prices per property (sale/rent)
    └── platform/       # Central Swagger UI (merged OpenAPI)
```

## Quick start

1. **Copy env and set required secrets**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set at least:

   - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (or use defaults).
   - `JWT_SECRET`, `REFRESH_JWT_SECRET` (users-service; min 32 chars).
   - Optionally: `BG_API_Key` (API key for listings, tenants, property, inventory, price), `GEOCODER_API_KEY`, `SENDGRID_API_KEY`.

2. **Start the stack**

   ```bash
   docker compose up --build
   ```

   Migrations run on startup for services that use them (listings, users, tenants, property, inventory, price). No need to run migrations manually for Docker.

3. **Endpoints**

   - Listings: <http://localhost:5001/listings> — docs: <http://localhost:5001/api-docs>
   - Users: <http://localhost:5002/users> — docs: <http://localhost:5002/api-docs>
   - Tenants: <http://localhost:5003/tenants> — docs: <http://localhost:5003/api-docs>
   - Property: <http://localhost:5004/properties> — docs: <http://localhost:5004/api-docs>
   - Inventory: <http://localhost:5005/inventory> — docs: <http://localhost:5005/api-docs>
   - Price: <http://localhost:5006/prices> — docs: <http://localhost:5006/api-docs>
   - **Platform (combined Swagger):** <http://localhost:5010/>

4. **Optional: API gateway (single port)**

   ```bash
   docker compose --profile gateway up --build
   ```

   Then: `/listings/*`, `/users/*`, `/tenants/*`, `/properties/*`, `/inventory/*`, `/prices/*` and `/platform/` (and `/swagger-ui/*` for platform assets) are proxied to the corresponding service. Combined docs at <http://localhost/platform/>.

## Environment variables

See `.env.example`. Summary:

- **Postgres:** `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`
- **URLs (host):** `DATABASE_URL` for local migrations/scripts
- **Ports (optional):** `LISTINGS_PORT`, `USERS_PORT`, `TENANTS_PORT`, `PROPERTY_PORT`, `INVENTORY_PORT`, `PRICE_PORT`, `PLATFORM_PORT` (defaults: 5001–5006, 5010)
- **Users auth:** `JWT_SECRET`, `REFRESH_JWT_SECRET`
- **API key:** `BG_API_Key` (optional; when set, listings/tenants/property/inventory/price require header `bg-api-key`)
- **Optional:** `GEOCODER_API_KEY` (listings), `SENDGRID_API_KEY` (tenants), `NODE_ENV`, `SERVER_URL`

## Auth

- **Users:** Register → Login returns access + refresh tokens (and cookies if used). Use `Authorization: Bearer <accessToken>` or cookie. Refresh via `POST /users/refreshToken` with `refreshToken` in body or cookie.
- **Listings, Tenants, Property, Inventory, Price:** If `BG_API_Key` is set in env, send header `bg-api-key` with that value. If unset, routes are open.

## Listings: property and price

- **Create listing:** Body must include `propertyId` (UUID) and `listingType` (`"rent"` or `"sales"`). Property must be **available**; price is fetched from the price service by type. Other fields (title, address, region, etc.) are filled from the property; you can override any of them.
- **Unavailable property:** Creating or updating a listing for a property with `availability: false` returns **409** with message `"Property currently unavailable"`.
- **Filter by type:** `GET /listings?listingType=rent` or `?listingType=sales`.

## Local development (without Docker)

1. Start PostgreSQL and set `DATABASE_URL` in `.env`.
2. From repo root:

   ```bash
   npm install
   npm run db:migrate --workspaces --if-present   # run all service migrations
   cd services/listings && npm run dev             # or users, tenants, property, inventory, price
   ```

   For the combined Swagger UI: `cd services/platform && npx tsx watch src/index.ts` (and ensure OpenAPI specs are resolvable; see platform’s merge logic).

## Scripts (from repo root)

- `npm run dev` – `docker compose up --build`
- `npm run build` – build all workspaces
- `npm run test` – run tests in all workspaces (run locally; not in Docker build)
- `npm run db:up` – `docker compose up -d postgres`
- `npm run db:migrate` – run migrations in all workspaces that define them

## License

ISC · Emmanuel Adedeji
