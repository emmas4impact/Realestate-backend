import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createHealthHandler, createRequestLogger, logger } from "@realestate/shared";
import { buildMergedSpec } from "./mergeSpecs.js";
import { buildVersionResponse } from "./version.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Docker: use dist/specs (copied in Dockerfile). Dev: use repo root + services/* paths.
const distSpecs = join(__dirname, "specs");
const repoRoot = join(__dirname, "..", "..", "..");

let mergedSpec: ReturnType<typeof buildMergedSpec>;

try {
  mergedSpec = buildMergedSpec(distSpecs, false);

  if (Object.keys(mergedSpec.paths as object).length === 0) {
    mergedSpec = buildMergedSpec(repoRoot, true);
  }
} catch (e) {
  try {
    mergedSpec = buildMergedSpec(repoRoot, true);
  } catch (e2) {
    logger.error("Failed to build merged OpenAPI spec", e2, { service: "platform" });

    mergedSpec = {
      openapi: "3.0.3",
      info: { title: "Real Estate Platform API", version: "1.0.0" },
      paths: {},
      components: { schemas: {} },
    };
  }
}

const app = express();

app.use(cors());
app.use(express.json());
app.use(createRequestLogger("platform"));

const gatewayRoutes = [
  { prefix: "/listings", target: process.env.LISTINGS_SERVICE_URL ?? "http://listings:5001" },
  { prefix: "/users", target: process.env.USERS_SERVICE_URL ?? "http://users:5002" },
  { prefix: "/tenants", target: process.env.TENANTS_SERVICE_URL ?? "http://tenant:5003" },
  { prefix: "/properties", target: process.env.PROPERTY_SERVICE_URL ?? "http://property:5004" },
  { prefix: "/inventories", target: process.env.INVENTORY_SERVICE_URL ?? "http://inventory:5005" },
  { prefix: "/prices", target: process.env.PRICE_SERVICE_URL ?? "http://price:5006" },
  { prefix: "/search", target: process.env.SEARCH_SERVICE_URL ?? "http://search:5007" },
];

function proxyHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();

    if (["connection", "content-length", "host"].includes(lower) || value == null) {
      continue;
    }

    headers[key] = Array.isArray(value) ? value.join(", ") : value;
  }

  return headers;
}

function buildProxyRequest(req: Request): RequestInit {
  const init: RequestInit = {
    method: req.method,
    headers: proxyHeaders(req),
  };

  if (!["GET", "HEAD"].includes(req.method.toUpperCase()) && req.body !== undefined) {
    init.body = JSON.stringify(req.body);
    init.headers = { ...init.headers, "content-type": "application/json" };
  }

  return init;
}

function copyResponseHeaders(upstream: globalThis.Response, res: Response) {
  upstream.headers.forEach((value, key) => {
    if (["content-encoding", "content-length", "transfer-encoding"].includes(key.toLowerCase())) {
      return;
    }

    res.setHeader(key, value);
  });
}

function createGatewayProxy(target: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const upstreamUrl = new URL(req.originalUrl, target);
      const upstream = await fetch(upstreamUrl, buildProxyRequest(req));

      copyResponseHeaders(upstream, res);

      res.status(upstream.status);

      const body = Buffer.from(await upstream.arrayBuffer());
      res.send(body);
    } catch (error) {
      next(error);
    }
  };
}

// Specific routes first so they are not handled by Swagger UI static
app.get("/openapi.json", (_req, res) => res.json(mergedSpec));

/**
 * Health endpoints
 * Kubernetes uses these for startup, liveness, and readiness checks.
 * These must stay before gateway proxy routes and Swagger UI.
 */
app.get("/health", createHealthHandler("platform"));

app.get("/health/live", (_req, res) => {
  res.status(200).json({
    status: "alive",
    service: "platform",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/health/ready", createHealthHandler("platform"));

app.get("/version", (_req, res) => res.json(buildVersionResponse()));

for (const route of gatewayRoutes) {
  app.use(route.prefix, createGatewayProxy(route.target));
}

// Mount Swagger UI static assets so the UI page can load
app.use(swaggerUi.serve);
app.get("/", swaggerUi.setup(mergedSpec, { explorer: true }));

const port = Number(process.env.PORT) || 5010;

if (!process.env.VITEST) {
  app.listen(port, () => {
    logger.info("Service started", { service: "platform", port });
  });
}

export default app;