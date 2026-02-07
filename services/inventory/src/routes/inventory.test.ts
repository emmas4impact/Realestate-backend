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
    inventory: {},
  };
});

const getApp = async () => (await import("../app.js")).default;

describe("Inventory routes", () => {
  beforeEach(() => {
    mockState.selectList = [];
    mockState.selectCount = 0;
    mockState.selectOne = [];
    mockState.insertReturn = [];
    mockState.updateReturn = [];
    mockState.deleteReturn = [];
  });

  it("GET /inventory returns 200 and paginated shape when no propertyId", async () => {
    const app = await getApp();
    const res = await request(app).get("/inventory");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("meta");
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("GET /inventory?propertyId=invalid returns 400", async () => {
    const app = await getApp();
    const res = await request(app).get("/inventory?propertyId=not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("GET /inventory?propertyId=x returns 200 and data array", async () => {
    mockState.selectList = [{ id: TEST_UUID, propertyId: PROP_UUID, quantity: 2, availableQuantity: 1 }];
    const app = await getApp();
    const res = await request(app).get(`/inventory?propertyId=${PROP_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("GET /inventory/:id returns 400 for invalid UUID", async () => {
    const app = await getApp();
    const res = await request(app).get("/inventory/not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("GET /inventory/:id returns 404 when not found", async () => {
    mockState.selectOne = [];
    const app = await getApp();
    const res = await request(app).get(`/inventory/${TEST_UUID}`);
    expect(res.status).toBe(404);
  });

  it("GET /inventory/:id returns 200 and item when found", async () => {
    const item = { id: TEST_UUID, propertyId: PROP_UUID, quantity: 5, availableQuantity: 3, unitType: "unit", name: "A", createdAt: new Date(), updatedAt: new Date() };
    mockState.selectOne = [item];
    const app = await getApp();
    const res = await request(app).get(`/inventory/${TEST_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(5);
  });

  it("POST /inventory returns 201 with single item", async () => {
    const created = { id: TEST_UUID, propertyId: PROP_UUID, quantity: 1, availableQuantity: 1, unitType: "unit", name: null, createdAt: new Date(), updatedAt: new Date() };
    mockState.insertReturn = [created];
    const app = await getApp();
    const res = await request(app).post("/inventory").send({ propertyId: PROP_UUID, quantity: 1 });
    expect(res.status).toBe(201);
    expect(res.body.propertyId).toBe(PROP_UUID);
  });

  it("POST /inventory returns 400 when propertyId missing", async () => {
    const app = await getApp();
    const res = await request(app).post("/inventory").send({ quantity: 1 });
    expect(res.status).toBe(400);
  });

  it("PUT /inventory/:id returns 404 when not found", async () => {
    mockState.updateReturn = [];
    const app = await getApp();
    const res = await request(app).put(`/inventory/${TEST_UUID}`).send({ quantity: 2 });
    expect(res.status).toBe(404);
  });

  it("PATCH /inventory/:id/decrement-available returns 200 and updated item", async () => {
    const updated = { id: TEST_UUID, propertyId: PROP_UUID, quantity: 2, availableQuantity: 1, unitType: "unit", name: null, createdAt: new Date(), updatedAt: new Date() };
    mockState.selectOne = [{ availableQuantity: 2 }];
    mockState.updateReturn = [updated];
    const app = await getApp();
    const res = await request(app).patch(`/inventory/${TEST_UUID}/decrement-available`).send({ amount: 1 });
    expect(res.status).toBe(200);
  });

  it("DELETE /inventory/:id returns 204 when deleted", async () => {
    mockState.deleteReturn = [{ id: TEST_UUID }];
    const app = await getApp();
    const res = await request(app).delete(`/inventory/${TEST_UUID}`);
    expect(res.status).toBe(204);
  });
});
