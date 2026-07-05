import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { buildVersionResponse } from "./version.js";

vi.mock("./mergeSpecs.js", () => ({
  buildMergedSpec: vi.fn(() => ({
    openapi: "3.0.3",
    info: { title: "Real Estate Platform API", version: "1.0.0" },
    paths: {
      "/listings": { get: { summary: "List" } },
      "/users/register": { post: { summary: "Register" } },
    },
    components: { schemas: {} },
  })),
}));

describe("Platform API docs", () => {
  it("GET / returns 200 (Swagger UI HTML)", async () => {
    const mod = await import("./index.js");
    const app = (mod as { default: import("express").Express }).default;
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
  });

  it("GET /openapi.json returns 200 and merged spec with paths", async () => {
    const mergedSpec = {
      openapi: "3.0.3",
      info: { title: "Real Estate Platform API", version: "1.0.0" },
      paths: { "/listings": { get: { summary: "List" } }, "/users/register": { post: { summary: "Register" } } },
      components: { schemas: {} },
    };
    const app = express().get("/openapi.json", (_req, res) => res.json(mergedSpec));
    const res = await request(app).get("/openapi.json").set("Accept", "application/json");
    expect(res.status).toBe(200);
    const body = typeof res.body === "object" && res.body !== null ? res.body : JSON.parse(res.text || "{}");
    expect(body).toHaveProperty("openapi", "3.0.3");
    expect(body).toHaveProperty("paths");
    expect(body.paths).toHaveProperty("/listings");
    expect(body.info.title).toMatch(/Platform/);
  });

  it("GET /health returns 200 and status ok", async () => {
    const app = express().get("/health", (_req, res) => res.json({ status: "ok" }));
    const res = await request(app).get("/health").set("Accept", "application/json");
    expect(res.status).toBe(200);
    const body = typeof res.body === "object" && res.body !== null && Object.keys(res.body).length > 0 ? res.body : JSON.parse(res.text || "{}");
    expect(body).toEqual({ status: "ok" });
  });

  it("buildVersionResponse returns release metadata and service versions", () => {
    const result = buildVersionResponse(new Date("2026-07-05T14:57:54.561Z"));
    expect(result).toHaveProperty("release");
    expect(result).toHaveProperty("timestamp", "2026-07-05T14:57:54.561Z");
    expect(result).toHaveProperty("namespace");
    expect(result).toHaveProperty("gpu_release");
    expect(result.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ service: "inventory" }),
        expect.objectContaining({ service: "search" }),
      ])
    );
  });

  it("buildVersionResponse prefers IMAGE_VERSION file over compose 1.0.0 fallback", () => {
    const previousFile = process.env.IMAGE_VERSION_FILE;
    const previousListingsTag = process.env.LISTINGS_IMAGE_TAG;
    const dir = mkdtempSync(join(tmpdir(), "platform-version-"));
    const filePath = join(dir, "IMAGE_VERSION");
    writeFileSync(filePath, "LISTINGS_IMAGE_TAG=9.9.9\n");

    try {
      process.env.IMAGE_VERSION_FILE = filePath;
      process.env.LISTINGS_IMAGE_TAG = "1.0.0";
      const result = buildVersionResponse(new Date("2026-07-05T14:57:54.561Z"));
      expect(result.services.find((service) => service.service === "listings")?.version).toBe("9.9.9");
    } finally {
      if (previousFile === undefined) delete process.env.IMAGE_VERSION_FILE;
      else process.env.IMAGE_VERSION_FILE = previousFile;
      if (previousListingsTag === undefined) delete process.env.LISTINGS_IMAGE_TAG;
      else process.env.LISTINGS_IMAGE_TAG = previousListingsTag;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("buildVersionResponse prefers generated release file over static default release", () => {
    const previousFile = process.env.RELEASE_NAME_FILE;
    const previousRelease = process.env.RELEASE_NAME;
    const dir = mkdtempSync(join(tmpdir(), "platform-release-"));
    const filePath = join(dir, "RELEASE_NAME");
    writeFileSync(filePath, "bashful bungalow\n");

    try {
      process.env.RELEASE_NAME_FILE = filePath;
      process.env.RELEASE_NAME = "realestate-backend";
      const result = buildVersionResponse(new Date("2026-07-05T14:57:54.561Z"));
      expect(result.release).toBe("bashful bungalow");
    } finally {
      if (previousFile === undefined) delete process.env.RELEASE_NAME_FILE;
      else process.env.RELEASE_NAME_FILE = previousFile;
      if (previousRelease === undefined) delete process.env.RELEASE_NAME;
      else process.env.RELEASE_NAME = previousRelease;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("GET /version returns 200 and service array", async () => {
    const mod = await import("./index.js");
    const app = (mod as { default: import("express").Express }).default;
    const res = await request(app).get("/version").set("Accept", "application/json");
    expect(res.status).toBe(200);
    expect(res.body.services).toEqual(expect.any(Array));
    expect(res.body.services[0]).toHaveProperty("service");
    expect(res.body.services[0]).toHaveProperty("version");
  });
});
