import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const SERVICE_TAGS = [
  ["listings", "LISTINGS_IMAGE_TAG"],
  ["users", "USERS_IMAGE_TAG"],
  ["tenants", "TENANTS_IMAGE_TAG"],
  ["property", "PROPERTY_IMAGE_TAG"],
  ["inventory", "INVENTORY_IMAGE_TAG"],
  ["price", "PRICE_IMAGE_TAG"],
  ["platform", "PLATFORM_IMAGE_TAG"],
  ["search", "SEARCH_IMAGE_TAG"],
] as const;

export interface ServiceVersion {
  service: string;
  version: string;
}

export interface VersionResponse {
  release: string;
  timestamp: string;
  namespace: string;
  gpu_release: string;
  services: ServiceVersion[];
}

function readVersionFile(): Record<string, string> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.IMAGE_VERSION_FILE,
    join(__dirname, "IMAGE_VERSION"),
    join(__dirname, "..", "IMAGE_VERSION"),
    join(__dirname, "..", "..", "..", "IMAGE_VERSION"),
  ].filter((value): value is string => Boolean(value));

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    const lines = readFileSync(filePath, "utf-8").split(/\r?\n/);
    return Object.fromEntries(
      lines
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const [key, ...rest] = line.split("=");
          return [key.trim(), rest.join("=").trim()];
        })
    );
  }

  return {};
}

function readTextFile(fileName: string): string | undefined {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env[`${fileName}_FILE`],
    join(__dirname, fileName),
    join(__dirname, "..", fileName),
    join(__dirname, "..", "..", "..", fileName),
  ].filter((value): value is string => Boolean(value));

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    const value = readFileSync(filePath, "utf-8").trim();
    if (value) return value;
  }

  return undefined;
}

function resolveServiceVersion(envKey: string, fileVersions: Record<string, string>): string {
  const envVersion = process.env[envKey]?.trim();
  const fileVersion = fileVersions[envKey]?.trim();

  if (envVersion && envVersion !== "1.0.0") {
    return envVersion;
  }

  if (fileVersion) {
    return fileVersion;
  }

  return envVersion || "unknown";
}

function resolveReleaseName(): string {
  const envRelease = (process.env.RELEASE_NAME ?? process.env.RELEASE)?.trim();
  const fileRelease = readTextFile("RELEASE_NAME");

  if (envRelease && envRelease !== "realestate-backend") {
    return envRelease;
  }

  return fileRelease ?? envRelease ?? "unknown release";
}

export function buildVersionResponse(now = new Date()): VersionResponse {
  const fileVersions = readVersionFile();
  const services = SERVICE_TAGS.map(([service, envKey]) => ({
    service,
    version: resolveServiceVersion(envKey, fileVersions),
  }));

  return {
    release: resolveReleaseName(),
    timestamp: now.toISOString(),
    namespace: process.env.NAMESPACE ?? process.env.KUBERNETES_NAMESPACE ?? "local",
    gpu_release: process.env.GPU_RELEASE ?? "",
    services,
  };
}
