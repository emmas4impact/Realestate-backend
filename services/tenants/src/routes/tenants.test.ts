import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const TEST_UUID = "550e8400-e29b-41d4-a716-446655440000";
const mockState = {
  selectList: [] as unknown[],
  selectCount: 0,
  selectOne: [] as unknown[],
  selectOneQueue: [] as unknown[][],
  listingOne: [] as unknown[],
  insertReturn: [] as unknown[],
  updateReturn: [] as unknown[],
  deleteReturn: [] as unknown[],
};
const consumeInventoryForPropertyMock = vi.hoisted(() => vi.fn());
const releaseInventoryForPropertyMock = vi.hoisted(() => vi.fn());

vi.mock("../services/inventory.js", () => ({
  consumeInventoryForProperty: consumeInventoryForPropertyMock,
  releaseInventoryForProperty: releaseInventoryForPropertyMock,
}));

vi.mock("../db/index.js", () => {
  const chain = (result: unknown) => ({ then: (fn: (r: unknown) => unknown) => Promise.resolve(result).then(fn) });
  const selectOneResult = () => mockState.selectOneQueue.shift() ?? mockState.selectOne;
  return {
    db: {
      select: (args?: { count?: unknown }) => ({
        from: () => ({
          where: () => ({
            limit: (n?: number) =>
              n === 1
                ? { then: (fn: (r: unknown) => unknown) => Promise.resolve(selectOneResult()).then(fn) }
                : { offset: () => chain(mockState.selectList) },
            then: (fn: (r: unknown) => unknown) =>
              args && typeof args === "object" && "count" in args
                ? Promise.resolve([{ count: mockState.selectCount }]).then(fn)
                : Promise.resolve(mockState.selectList).then(fn),
          }),
          limit: (n?: number) =>
            n === 1
              ? { then: (fn: (r: unknown) => unknown) => Promise.resolve(selectOneResult()).then(fn) }
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
    mockState.selectOneQueue = [];
    mockState.listingOne = [];
    mockState.insertReturn = [];
    mockState.updateReturn = [];
    mockState.deleteReturn = [];
    consumeInventoryForPropertyMock.mockResolvedValue({ ok: true });
    releaseInventoryForPropertyMock.mockResolvedValue({ ok: true });
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
    mockState.selectOne = [{ id: created.listingId, propertyId: "550e8400-e29b-41d4-a716-446655440099", listingType: "rent" }];
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
        listingType: "rent",
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("John");
    expect(consumeInventoryForPropertyMock).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440099");
  });

  it("POST /tenants returns 404 when listing does not exist", async () => {
    mockState.selectOne = [];
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
        listingType: "rent",
      });
    expect(res.status).toBe(404);
  });

  it("POST /tenants returns 400 when listingType is missing", async () => {
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
    expect(res.status).toBe(400);
  });

  it("POST /tenants returns 201 when listing is for sales and payload says sales", async () => {
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
    mockState.selectOne = [{ id: "550e8400-e29b-41d4-a716-446655440001", propertyId: "550e8400-e29b-41d4-a716-446655440099", listingType: "sales" }];
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
        listingType: "sales",
      });
    expect(res.status).toBe(201);
  });

  it("POST /tenants returns 409 when listing type does not match payload", async () => {
    mockState.selectOne = [{ id: "550e8400-e29b-41d4-a716-446655440001", propertyId: "550e8400-e29b-41d4-a716-446655440099", listingType: "sales" }];
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
        listingType: "rent",
      });
    expect(res.status).toBe(409);
  });

  it("POST /tenants returns 409 when inventory is unavailable", async () => {
    mockState.selectOne = [{ id: "550e8400-e29b-41d4-a716-446655440001", propertyId: "550e8400-e29b-41d4-a716-446655440099", listingType: "rent" }];
    consumeInventoryForPropertyMock.mockResolvedValue({
      ok: false,
      status: 409,
      message: "No available inventory for this listing",
    });
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
        listingType: "rent",
      });
    expect(res.status).toBe(409);
  });

  it("POST /tenants returns 400 for Mongo-style listingId", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/tenants")
      .send({
        name: "John",
        surname: "Doe",
        employer: "Corp",
        phone: "+456",
        email: "john@test.com",
        listingId: "68dd8d6d8e0a6d2354547917",
        listingType: "rent",
      });
    expect(res.status).toBe(400);
  });

  it("PUT /tenants/:id returns 404 when not found", async () => {
    mockState.updateReturn = [];
    const app = await getApp();
    const res = await request(app)
      .put(`/tenants/${TEST_UUID}`)
      .send({ name: "Updated" });
    expect(res.status).toBe(404);
  });

  it("PUT /tenants/:id returns 400 for Mongo-style listingId", async () => {
    const app = await getApp();
    const res = await request(app)
      .put(`/tenants/${TEST_UUID}`)
      .send({ listingId: "68dd8d6d8e0a6d2354547917" });
    expect(res.status).toBe(400);
  });

  it("PUT /tenants/:id returns 409 when new listing type does not match payload", async () => {
    mockState.selectOne = [{ id: "550e8400-e29b-41d4-a716-446655440001", propertyId: "550e8400-e29b-41d4-a716-446655440099", listingType: "sales" }];
    const app = await getApp();
    const res = await request(app)
      .put(`/tenants/${TEST_UUID}`)
      .send({ listingId: "550e8400-e29b-41d4-a716-446655440001", listingType: "rent" });
    expect(res.status).toBe(409);
  });

  it("DELETE /tenants/:id returns 204 when deleted", async () => {
    mockState.selectOneQueue = [
      [{ id: TEST_UUID, listingId: "550e8400-e29b-41d4-a716-446655440001" }],
      [{ id: "550e8400-e29b-41d4-a716-446655440001", propertyId: "550e8400-e29b-41d4-a716-446655440099" }],
    ];
    mockState.deleteReturn = [{ id: TEST_UUID }];
    const app = await getApp();
    const res = await request(app).delete(`/tenants/${TEST_UUID}`);
    expect(res.status).toBe(204);
    expect(releaseInventoryForPropertyMock).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440099");
  });

  it("DELETE /tenants/:id returns 404 when not found", async () => {
    mockState.selectOne = [];
    const app = await getApp();
    const res = await request(app).delete(`/tenants/${TEST_UUID}`);
    expect(res.status).toBe(404);
  });

  it("DELETE /tenants/:id returns 503 when inventory release fails", async () => {
    mockState.selectOneQueue = [
      [{ id: TEST_UUID, listingId: "550e8400-e29b-41d4-a716-446655440001" }],
      [{ id: "550e8400-e29b-41d4-a716-446655440001", propertyId: "550e8400-e29b-41d4-a716-446655440099" }],
    ];
    releaseInventoryForPropertyMock.mockResolvedValue({
      ok: false,
      status: 503,
      message: "Unable to increment inventory",
    });
    const app = await getApp();
    const res = await request(app).delete(`/tenants/${TEST_UUID}`);
    expect(res.status).toBe(503);
    expect(mockState.deleteReturn).toEqual([]);
  });
});
