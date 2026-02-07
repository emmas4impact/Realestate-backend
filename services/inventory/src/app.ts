import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";
import swaggerUi from "swagger-ui-express";
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

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));
app.get("/openapi.json", (_req, res) => res.json(openapiDoc));

app.use(apiKeyAuth);
app.use("/inventory", inventoryRouter);

app.use(errorHandler);
export default app;
