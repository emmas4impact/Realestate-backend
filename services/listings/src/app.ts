import express from "express";
import cors from "cors";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";
import swaggerUi from "swagger-ui-express";
import { apiKeyAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import listingsRouter from "./routes/listings.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const candidates = [
  join(__dirname, "openapi.yaml"),
  join(__dirname, "..", "src", "openapi.yaml"),
  join(__dirname, "..", "openapi.yaml"),
];
const openapiPath = candidates.find((p) => existsSync(p)) ?? candidates[0];
let openapiDoc: Record<string, unknown>;
try {
  openapiDoc = YAML.parse(readFileSync(openapiPath, "utf-8"));
} catch (e) {
  throw new Error(`OpenAPI file not found (tried: ${candidates.join(", ")}): ${e}`);
}

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));
app.get("/openapi.json", (_req, res) => res.json(openapiDoc));

app.use(apiKeyAuth);
app.use("/listings", listingsRouter);

app.use(errorHandler);
export default app;
