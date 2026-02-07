import { readFileSync, existsSync } from "fs";
import { join } from "path";
import YAML from "yaml";

/** Paths relative to baseDir. Docker: baseDir = dist/specs; dev: baseDir = repo root */
const SERVICE_SPECS: { name: string; path: string }[] = [
  { name: "Listings", path: "listings/openapi.yaml" },
  { name: "Users", path: "users/openapi.yaml" },
  { name: "Tenants", path: "tenants/openapi.yaml" },
  { name: "Property", path: "property/openapi.yaml" },
  { name: "Inventory", path: "inventory/openapi.yaml" },
  { name: "Price", path: "price/openapi.yaml" },
];

const FALLBACK_SPECS_DEV: { name: string; path: string }[] = [
  { name: "Listings", path: "services/listings/src/openapi.yaml" },
  { name: "Users", path: "services/users/src/openapi.yaml" },
  { name: "Tenants", path: "services/tenants/src/openapi.yaml" },
  { name: "Property", path: "services/property/openapi.yaml" },
  { name: "Inventory", path: "services/inventory/openapi.yaml" },
  { name: "Price", path: "services/price/openapi.yaml" },
];

type Obj = Record<string, unknown>;

const OPERATION_KEYS = ["get", "post", "put", "patch", "delete", "head", "options"];

/** Ensure every operation under a path has the service tag so Swagger UI groups by service. */
function ensureServiceTag(pathItem: Obj, serviceName: string): Obj {
  const out = { ...pathItem };
  for (const method of OPERATION_KEYS) {
    const op = out[method] as Obj | undefined;
    if (!op || typeof op !== "object") continue;
    const existing = (op.tags as string[] | undefined) ?? [];
    const withService = existing.includes(serviceName) ? existing : [serviceName, ...existing];
    out[method] = { ...op, tags: withService };
  }
  return out;
}

function rewriteRefs(obj: unknown, prefix: string): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => rewriteRefs(item, prefix));
  const o = obj as Obj;
  if (typeof o.$ref === "string" && o.$ref.startsWith("#/components/schemas/")) {
    const name = o.$ref.replace("#/components/schemas/", "");
    return { ...o, $ref: `#/components/schemas/${prefix}_${name}` };
  }
  const out: Obj = {};
  for (const [k, v] of Object.entries(o)) out[k] = rewriteRefs(v, prefix);
  return out;
}

export function buildMergedSpec(baseDir: string, useFallbackPaths = false): Obj {
  const paths: Obj = {};
  const schemas: Obj = {};
  const tags: { name: string; description?: string }[] = [];
  const specs = useFallbackPaths ? FALLBACK_SPECS_DEV : SERVICE_SPECS;

  for (const { name, path: specPath } of specs) {
    const fullPath = join(baseDir, specPath);
    let spec: Obj;
    try {
      if (!existsSync(fullPath)) continue;
      spec = YAML.parse(readFileSync(fullPath, "utf-8")) as Obj;
    } catch {
      continue;
    }
    const prefix = name;
    const specPaths = spec.paths as Obj | undefined;
    const specSchemas = (spec.components as Obj)?.schemas as Obj | undefined;
    const specTags = spec.tags as { name: string; description?: string }[] | undefined;

    if (specPaths) {
      for (const [pathKey, pathItem] of Object.entries(specPaths)) {
        const withRefs = rewriteRefs(pathItem, prefix) as Obj;
        paths[pathKey] = ensureServiceTag(withRefs, name);
      }
    }
    if (specSchemas) {
      for (const [schemaKey, schemaVal] of Object.entries(specSchemas)) {
        schemas[`${prefix}_${schemaKey}`] = rewriteRefs(schemaVal, prefix) as Obj;
      }
    }
    if (Array.isArray(specTags)) {
      for (const t of specTags) {
        if (!tags.some((x) => x.name === t.name)) tags.push(t);
      }
    }
  }

  // Fixed tag order so Swagger UI shows each service under its own section
  const tagOrder = ["Listings", "Users", "Tenants", "Property", "Inventory", "Price"];
  const orderedTags = tagOrder.map((name) => ({
    name,
    description: tags.find((t) => t.name === name)?.description ?? `${name} service`,
  }));

  return {
    openapi: "3.0.3",
    info: {
      title: "Real Estate Platform API",
      description:
        "Combined API for Listings, Users, Tenants, Property, Inventory, and Price services. Use the gateway server to call any endpoint from one origin.",
      version: "1.0.0",
    },
    servers: [
      { url: "http://localhost", description: "Gateway (all services via Caddy)" },
      { url: "http://localhost:5001", description: "Listings" },
      { url: "http://localhost:5002", description: "Users" },
      { url: "http://localhost:5003", description: "Tenants" },
      { url: "http://localhost:5004", description: "Property" },
      { url: "http://localhost:5005", description: "Inventory" },
      { url: "http://localhost:5006", description: "Price" },
    ],
    tags: orderedTags,
    paths,
    components: { schemas },
  };
}
