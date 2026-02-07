import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const TEST_UUID = "550e8400-e29b-41d4-a716-446655440000";
const mockState = vi.hoisted(() => ({
  selectList: [] as unknown[],
  selectCount: 0,
  selectOne: [] as unknown[],
  insertReturn: [] as unknown[],
  updateReturn: [] as unknown[],
  deleteReturn: [] as unknown[],
}));

vi.mock("../db/index.js", () => {
  const chain = (result: unknown) => ({ then: (fn: (r: unknown) => unknown) => Promise.resolve(result).then(fn) });
  const orderByChain = () => ({
    limit: (_n?: number) => ({ offset: () => chain(mockState.selectList) }),
    then: (fn: (r: unknown) => unknown) => Promise.resolve([{ count: mockState.selectCount }]).then(fn),
  });
  return {
    db: {
      select: (args?: { count?: unknown }) => ({
        from: () => ({
          where: () => ({
            limit: (n?: number) =>
              n === 1
                ? { then: (fn: (r: unknown) => unknown) => Promise.resolve(mockState.selectOne).then(fn) }
                : { offset: () => chain(mockState.selectList) },
            then: (fn: (r: unknown) => unknown) =>
              args && typeof args === "object" && "count" in args
                ? Promise.resolve([{ count: mockState.selectCount }]).then(fn)
                : Promise.resolve(mockState.selectList).then(fn),
            orderBy: orderByChain,
          }),
          orderBy: orderByChain,
          limit: (n?: number) =>
            n === 1
              ? { then: (fn: (r: unknown) => unknown) => Promise.resolve(mockState.selectOne).then(fn) }
              : { offset: () => chain(mockState.selectList) },
          then: (fn: (r: unknown) => unknown) => Promise.resolve([{ count: mockState.selectCount }]).then(fn),
        }),
      }),
      insert: () => ({
        values: () => ({
          returning: () => Promise.resolve(mockState.insertReturn),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve(mockState.updateReturn),
          }),
        }),
      }),
      delete: () => ({
        where: () => ({
          returning: () => Promise.resolve(mockState.deleteReturn),
        }),
      }),
    },
    properties: {},
  };
});

vi.mock("../services/fetchInventoryAndPrices.js", () => ({
  fetchInventoryForProperty: () => Promise.resolve([]),
  fetchPricesForProperty: () => Promise.resolve([]),
}));

const getApp = async () => (await import("../app.js")).default;

describe("Property routes", () => {
  beforeEach(() => {
    mockState.selectList = [];
    mockState.selectCount = 0;
    mockState.selectOne = [];
    mockState.insertReturn = [];
    mockState.updateReturn = [];
    mockState.deleteReturn = [];
  });

  it("GET /properties returns 200 and paginated shape", async () => {
    const app = await getApp();
    const res = await request(app).get("/properties");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("meta");
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty("inventory");
      expect(res.body.data[0]).toHaveProperty("availability");
    }
  });

  it("GET /properties/:id returns 400 for invalid UUID", async () => {
    const app = await getApp();
    const res = await request(app).get("/properties/not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("GET /properties/:id returns 404 when not found", async () => {
    mockState.selectOne = [];
    const app = await getApp();
    const res = await request(app).get(`/properties/${TEST_UUID}`);
    expect(res.status).toBe(404);
  });

  it("GET /properties/:id returns 200 with inventory and availability", async () => {
    const row = { id: TEST_UUID, status: "Active", type: "residential", category: "house", address: null, region: "R", district: "D", sizeSqft: null, lotSizeSqft: null, bedrooms: null, bathrooms: null, yearBuilt: null, description: "", features: [], images: [], createdAt: new Date(), updatedAt: new Date() };
    mockState.selectOne = [row];
    const app = await getApp();
    const res = await request(app).get(`/properties/${TEST_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("inventory");
    expect(res.body).toHaveProperty("availability");
    expect(res.body.availability).toBe(false);
  });

  it("POST /properties returns 201 with availability false", async () => {
    const created = { id: TEST_UUID, status: "Active", type: "residential", category: "apartment", address: null, region: "R", district: "D", sizeSqft: null, lotSizeSqft: null, bedrooms: 2, bathrooms: 1, yearBuilt: null, description: "", features: [], images: [], createdAt: new Date(), updatedAt: new Date() };
    mockState.insertReturn = [created];
    const app = await getApp();
    const res = await request(app).post("/properties").send({ type: "residential", category: "apartment", region: "R", district: "D" });
    expect(res.status).toBe(201);
    expect(res.body.availability).toBe(false);
  });

  it("PUT /properties/:id returns 404 when not found", async () => {
    mockState.updateReturn = [];
    const app = await getApp();
    const res = await request(app).put(`/properties/${TEST_UUID}`).send({ type: "residential", category: "house", region: "R", district: "D" });
    expect(res.status).toBe(404);
  });

  it("DELETE /properties/:id returns 204 when deleted", async () => {
    mockState.deleteReturn = [{ id: TEST_UUID }];
    const app = await getApp();
    const res = await request(app).delete(`/properties/${TEST_UUID}`);
    expect(res.status).toBe(204);
  });
});
