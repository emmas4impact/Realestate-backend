import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const TEST_UUID = "550e8400-e29b-41d4-a716-446655440000";
const PROP_UUID = "550e8400-e29b-41d4-a716-446655440001";
const mockState = {
  selectList: [] as unknown[],
  selectCount: 0,
  selectOne: [] as unknown[],
  insertReturn: [] as unknown[],
  updateReturn: [] as unknown[],
  deleteReturn: [] as unknown[],
};

vi.mock("../db/index.js", () => {
  const chain = (result: unknown) => ({ then: (fn: (r: unknown) => unknown) => Promise.resolve(result).then(fn) });
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
          }),
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
    prices: {},
  };
});

const getApp = async () => (await import("../app.js")).default;

describe("Price routes", () => {
  beforeEach(() => {
    mockState.selectList = [];
    mockState.selectCount = 0;
    mockState.selectOne = [];
    mockState.insertReturn = [];
    mockState.updateReturn = [];
    mockState.deleteReturn = [];
  });

  it("GET /prices returns 200 and paginated shape", async () => {
    const app = await getApp();
    const res = await request(app).get("/prices");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("meta");
  });

  it("GET /prices?propertyId=invalid returns 400", async () => {
    const app = await getApp();
    const res = await request(app).get("/prices?propertyId=not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("GET /prices/:id returns 400 for invalid UUID", async () => {
    const app = await getApp();
    const res = await request(app).get("/prices/not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("GET /prices/:id returns 404 when not found", async () => {
    mockState.selectOne = [];
    const app = await getApp();
    const res = await request(app).get(`/prices/${TEST_UUID}`);
    expect(res.status).toBe(404);
  });

  it("GET /prices/:id returns 200 when found", async () => {
    const row = { id: TEST_UUID, propertyId: PROP_UUID, amount: 1000, currency: "USD", type: "sale", start_at: null, end_at: null, createdAt: new Date(), updatedAt: new Date() };
    mockState.selectOne = [row];
    const app = await getApp();
    const res = await request(app).get(`/prices/${TEST_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(1000);
  });

  it("POST /prices returns 201 with single price", async () => {
    const created = { id: TEST_UUID, propertyId: PROP_UUID, amount: 500, currency: "USD", type: "rent", start_at: null, end_at: null, createdAt: new Date(), updatedAt: new Date() };
    mockState.insertReturn = [created];
    const app = await getApp();
    const res = await request(app).post("/prices").send({ propertyId: PROP_UUID, amount: 500 });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(500);
  });

  it("POST /prices returns 400 when propertyId missing", async () => {
    const app = await getApp();
    const res = await request(app).post("/prices").send({ amount: 100 });
    expect(res.status).toBe(400);
  });

  it("PUT /prices/:id returns 404 when not found", async () => {
    mockState.updateReturn = [];
    const app = await getApp();
    const res = await request(app).put(`/prices/${TEST_UUID}`).send({ amount: 200 });
    expect(res.status).toBe(404);
  });

  it("DELETE /prices/:id returns 204 when deleted", async () => {
    mockState.deleteReturn = [{ id: TEST_UUID }];
    const app = await getApp();
    const res = await request(app).delete(`/prices/${TEST_UUID}`);
    expect(res.status).toBe(204);
  });
});
