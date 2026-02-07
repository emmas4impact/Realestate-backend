import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const TEST_UUID = "550e8400-e29b-41d4-a716-446655440000";
const mockState = {
  selectList: [] as unknown[],
  selectCount: 0,
  selectOne: [] as unknown[],
  listingOne: [] as unknown[],
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
    tenants: {},
    listings: {},
  };
});

const getApp = async () => (await import("../app.js")).default;

describe("Tenants routes", () => {
  beforeEach(() => {
    mockState.selectList = [];
    mockState.selectCount = 0;
    mockState.selectOne = [];
    mockState.listingOne = [];
    mockState.insertReturn = [];
    mockState.updateReturn = [];
    mockState.deleteReturn = [];
  });

  it("GET /tenants returns 200 and paginated shape", async () => {
    const app = await getApp();
    const res = await request(app).get("/tenants");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("meta");
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("GET /tenants?listingId=invalid returns 400", async () => {
    const app = await getApp();
    const res = await request(app).get("/tenants?listingId=not-a-uuid");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/UUID/);
  });

  it("GET /tenants/listing/:listingId returns 400 for invalid UUID", async () => {
    const app = await getApp();
    const res = await request(app).get("/tenants/listing/not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("GET /tenants/listing/:listingId returns 404 when listing not found", async () => {
    mockState.selectOne = [];
    const app = await getApp();
    const res = await request(app).get(`/tenants/listing/${TEST_UUID}`);
    expect(res.status).toBe(404);
  });

  it("GET /tenants/:id returns 404 when not found", async () => {
    mockState.selectOne = [];
    const app = await getApp();
    const res = await request(app).get(`/tenants/${TEST_UUID}`);
    expect(res.status).toBe(404);
  });

  it("GET /tenants/:id returns 200 and tenant when found", async () => {
    const tenant = {
      id: TEST_UUID,
      name: "Jane",
      surname: "Doe",
      employer: "Acme",
      phone: "+123",
      email: "jane@test.com",
      listingId: "550e8400-e29b-41d4-a716-446655440001",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockState.selectOne = [tenant];
    const app = await getApp();
    const res = await request(app).get(`/tenants/${TEST_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Jane");
  });

  it("GET /tenants/:id returns 400 for invalid UUID", async () => {
    const app = await getApp();
    const res = await request(app).get("/tenants/invalid-id");
    expect(res.status).toBe(400);
  });

  it("POST /tenants returns 201 with created tenant", async () => {
    const created = {
      id: TEST_UUID,
      name: "John",
      surname: "Doe",
      employer: "Corp",
      phone: "+456",
      email: "john@test.com",
      listingId: "550e8400-e29b-41d4-a716-446655440001",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockState.insertReturn = [created];
    const app = await getApp();
    const res = await request(app)
      .post("/tenants")
      .send({
        name: "John",
        surname: "Doe",
        employer: "Corp",
        phone: "+456",
        email: "john@test.com",
        listingId: "550e8400-e29b-41d4-a716-446655440001",
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("John");
  });

  it("PUT /tenants/:id returns 404 when not found", async () => {
    mockState.updateReturn = [];
    const app = await getApp();
    const res = await request(app)
      .put(`/tenants/${TEST_UUID}`)
      .send({ name: "Updated" });
    expect(res.status).toBe(404);
  });

  it("DELETE /tenants/:id returns 204 when deleted", async () => {
    mockState.deleteReturn = [{ id: TEST_UUID }];
    const app = await getApp();
    const res = await request(app).delete(`/tenants/${TEST_UUID}`);
    expect(res.status).toBe(204);
  });

  it("DELETE /tenants/:id returns 404 when not found", async () => {
    mockState.deleteReturn = [];
    const app = await getApp();
    const res = await request(app).delete(`/tenants/${TEST_UUID}`);
    expect(res.status).toBe(404);
  });
});
