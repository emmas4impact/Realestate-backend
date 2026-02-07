import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildMergedSpec } from "./mergeSpecs.js";

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
    console.error("Failed to build merged OpenAPI spec:", e2);
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

// Specific routes first so they are not handled by Swagger UI static
app.get("/openapi.json", (_req, res) => res.json(mergedSpec));
app.get("/health", (_req, res) => res.json({ status: "ok" }));
// Mount Swagger UI static assets (swagger-ui-bundle.js, swagger-ui.css, etc.) so the UI page can load
app.use(swaggerUi.serve);
app.get("/", swaggerUi.setup(mergedSpec, { explorer: true }));

const port = Number(process.env.PORT) || 5010;
if (!process.env.VITEST) {
  app.listen(port, () => {
    console.log(`Platform API docs at http://localhost:${port}`);
  });
}
export default app;
