import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";
import swaggerUi from "swagger-ui-express";
import { createHealthHandler, createRequestLogger } from "@realestate/shared";
import { apiKeyAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import inventoryRouter from "./routes/inventory.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const openapiPath = join(__dirname, "openapi.yaml");

let openapiDoc: Record<string, unknown>;

try {
  openapiDoc = YAML.parse(readFileSync(openapiPath, "utf-8"));
} catch {
  openapiDoc = YAML.parse(readFileSync(join(__dirname, "..", "openapi.yaml"), "utf-8"));
}

const app = express();

app.use(cors());
app.use(express.json());
app.use(createRequestLogger("inventory"));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));
app.get("/openapi.json", (_req, res) => res.json(openapiDoc));

/**
 * Health endpoints
 * These must stay before apiKeyAuth so Kubernetes can call them without authentication.
 */
app.get("/health", createHealthHandler("inventory"));

app.get("/health/live", (_req, res) => {
  res.status(200).json({
    status: "alive",
    service: "inventory",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get("/health/ready", createHealthHandler("inventory"));

app.use(apiKeyAuth);

app.use("/inventories", inventoryRouter);

// Backward-compatible alias. Prefer /inventories for new clients.
app.use("/inventory", inventoryRouter);

app.use(errorHandler);

export default app;