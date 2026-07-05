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

  it("GET /inventories returns 200 and paginated shape when no propertyId", async () => {
    const app = await getApp();
    const res = await request(app).get("/inventories");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("meta");
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("GET /inventories?propertyId=invalid returns 400", async () => {
    const app = await getApp();
    const res = await request(app).get("/inventories?propertyId=not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("GET /inventories?propertyId=x returns 200 and data array", async () => {
    mockState.selectList = [{ id: TEST_UUID, propertyId: PROP_UUID, quantity: 2, availableQuantity: 1 }];
    const app = await getApp();
    const res = await request(app).get(`/inventories?propertyId=${PROP_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("GET /inventories/:id returns 400 for invalid UUID", async () => {
    const app = await getApp();
    const res = await request(app).get("/inventories/not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("GET /inventories/:id returns 404 when not found", async () => {
    mockState.selectOne = [];
    const app = await getApp();
    const res = await request(app).get(`/inventories/${TEST_UUID}`);
    expect(res.status).toBe(404);
  });

  it("GET /inventories/:id returns 200 and item when found", async () => {
    const item = { id: TEST_UUID, propertyId: PROP_UUID, quantity: 5, availableQuantity: 3, unitType: "unit", name: "A", createdAt: new Date(), updatedAt: new Date() };
    mockState.selectOne = [item];
    const app = await getApp();
    const res = await request(app).get(`/inventories/${TEST_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(5);
  });

  it("POST /inventories returns 201 with single item", async () => {
    const created = { id: TEST_UUID, propertyId: PROP_UUID, quantity: 1, availableQuantity: 1, unitType: "unit", name: null, createdAt: new Date(), updatedAt: new Date() };
    mockState.insertReturn = [created];
    const app = await getApp();
    const res = await request(app).post("/inventories").send({ propertyId: PROP_UUID, quantity: 1 });
    expect(res.status).toBe(201);
    expect(res.body.propertyId).toBe(PROP_UUID);
  });

  it("POST /inventories returns 400 when propertyId missing", async () => {
    const app = await getApp();
    const res = await request(app).post("/inventories").send({ quantity: 1 });
    expect(res.status).toBe(400);
  });

  it("PUT /inventories/:id returns 404 when not found", async () => {
    mockState.updateReturn = [];
    const app = await getApp();
    const res = await request(app).put(`/inventories/${TEST_UUID}`).send({ quantity: 2 });
    expect(res.status).toBe(404);
  });

  it("PUT /inventories/:id returns 400 for Mongo-style propertyId", async () => {
    const app = await getApp();
    const res = await request(app).put(`/inventories/${TEST_UUID}`).send({ propertyId: "68dd8d6d8e0a6d2354547917" });
    expect(res.status).toBe(400);
  });

  it("PATCH /inventories/:id/decrement-available returns 200 and updated item", async () => {
    const updated = { id: TEST_UUID, propertyId: PROP_UUID, quantity: 2, availableQuantity: 1, unitType: "unit", name: null, createdAt: new Date(), updatedAt: new Date() };
    mockState.selectOne = [{ availableQuantity: 2 }];
    mockState.updateReturn = [updated];
    const app = await getApp();
    const res = await request(app).patch(`/inventories/${TEST_UUID}/decrement-available`).send({ amount: 1 });
    expect(res.status).toBe(200);
  });

  it("PATCH /inventories/:id/increment-available returns 200 and caps at quantity", async () => {
    const updated = { id: TEST_UUID, propertyId: PROP_UUID, quantity: 5, availableQuantity: 5, unitType: "unit", name: null, createdAt: new Date(), updatedAt: new Date() };
    mockState.selectOne = [{ quantity: 5, availableQuantity: 4 }];
    mockState.updateReturn = [updated];
    const app = await getApp();
    const res = await request(app).patch(`/inventories/${TEST_UUID}/increment-available`).send({ amount: 3 });
    expect(res.status).toBe(200);
    expect(res.body.availableQuantity).toBe(5);
  });

  it("DELETE /inventories/:id returns 204 when deleted", async () => {
    mockState.deleteReturn = [{ id: TEST_UUID }];
    const app = await getApp();
    const res = await request(app).delete(`/inventories/${TEST_UUID}`);
    expect(res.status).toBe(204);
  });
});
