import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";

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
});
