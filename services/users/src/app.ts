import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "./middleware/errorHandler.js";
import usersRouter from "./routes/users.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const openapiPath = join(__dirname, "openapi.yaml");
let openapiDoc: Record<string, unknown>;
try {
  openapiDoc = YAML.parse(readFileSync(openapiPath, "utf-8"));
} catch {
  openapiDoc = YAML.parse(readFileSync(join(__dirname, "..", "openapi.yaml"), "utf-8"));
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));
app.get("/openapi.json", (_req, res) => res.json(openapiDoc));

app.use("/users", usersRouter);

app.use(errorHandler);
export default app;
