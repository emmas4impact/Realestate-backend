import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test:test@localhost:5432/test";
});

const mockState = vi.hoisted(() => ({
  selectList: [] as unknown[],
  selectCount: 0,
  selectOne: [] as unknown[],
  insertReturn: [] as unknown[],
  updateReturn: [] as unknown[],
  deleteReturn: [] as unknown[],
}));

vi.mock("../db/index.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../db/index.js")>();
  const mockDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({
              offset: () => Promise.resolve(mockState.selectList),
            }),
          }),
          limit: () => Promise.resolve(mockState.selectOne),
          then: (fn: (r: { count: number }[]) => unknown) =>
            Promise.resolve([{ count: mockState.selectCount }]).then(fn),
        }),
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
  };
  return { ...orig, db: mockDb };
});

vi.mock("../services/geocoder.js", () => ({
  geocodeAddress: () => Promise.resolve(null),
}));

const fetchPropertyMock = vi.hoisted(() => vi.fn());
const fetchPriceAmountForTypeMock = vi.hoisted(() => vi.fn());
vi.mock("../services/fetchPropertyAndPrice.js", () => ({
  fetchProperty: (...args: unknown[]) => fetchPropertyMock(...args),
  fetchPriceAmountForType: (...args: unknown[]) => fetchPriceAmountForTypeMock(...args),
}));

// Import app after mocks so routes use mocked db
const getApp = async () => (await import("../app.js")).default;

const PROP_ID = "550e8400-e29b-41d4-a716-446655440099";

describe("Listings routes", () => {
  beforeEach(() => {
    mockState.selectList = [];
    mockState.selectCount = 0;
    mockState.selectOne = [];
    mockState.insertReturn = [];
    mockState.updateReturn = [];
    mockState.deleteReturn = [];
    fetchPropertyMock.mockResolvedValue({
      id: PROP_ID,
      availability: true,
      address: "123 Main St",
      region: "NY",
      district: "Manhattan",
      type: "apartment",
      category: "residential",
      description: "Spacious unit",
      features: ["parking"],
      images: ["https://example.com/1.jpg"],
    });
    fetchPriceAmountForTypeMock.mockResolvedValue(2500);
  });

  it("GET /listings returns 200 and paginated shape", async () => {
    const app = await getApp();
    const res = await request(app).get("/listings").set("bg-api-key", "test-key");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("meta");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 0 });
  });

  it("GET /listings/:id returns 404 when not found", async () => {
    mockState.selectOne = [];
    const app = await getApp();
    const res = await request(app).get("/listings/550e8400-e29b-41d4-a716-446655440000").set("bg-api-key", "test-key");
    expect(res.status).toBe(404);
  });

  it("GET /listings/:id returns 200 and listing when found", async () => {
    const listing = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      propertyId: PROP_ID,
      listingType: "rent",
      title: "Test",
      region: "NY",
      district: "Manhattan",
      type: "apartment",
      category: "rent",
      price: 2000,
      rating: 0,
      description: "Desc",
      features: [],
      details: [],
      image: "https://example.com/img.jpg",
      images: [],
      status: "Active",
      address: null,
      location: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockState.selectOne = [listing];
    const app = await getApp();
    const res = await request(app).get("/listings/550e8400-e29b-41d4-a716-446655440000").set("bg-api-key", "test-key");
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Test");
  });

  it("GET /listings/districts/:district returns array and count", async () => {
    const app = await getApp();
    const res = await request(app).get("/listings/districts/Brooklyn").set("bg-api-key", "test-key");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("count");
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("GET /listings/price/range requires minPrice and maxPrice", async () => {
    const app = await getApp();
    const res = await request(app).get("/listings/price/range").set("bg-api-key", "test-key");
    expect(res.status).toBe(400);
  });

  it("POST /listings returns 400 when propertyId missing or invalid", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/listings")
      .set("bg-api-key", "test-key")
      .send({
        listingType: "rent",
        title: "New",
        region: "NY",
        district: "Manhattan",
        type: "apartment",
        category: "rent",
        description: "D",
        features: [],
        details: [],
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/propertyId/);
  });

  it("POST /listings returns 400 when listingType missing or invalid", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/listings")
      .set("bg-api-key", "test-key")
      .send({
        propertyId: PROP_ID,
        title: "New",
        region: "NY",
        district: "Manhattan",
        type: "apartment",
        category: "rent",
        description: "D",
        features: [],
        details: [],
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/listingType/);
  });

  it("POST /listings returns 409 when property is unavailable", async () => {
    fetchPropertyMock.mockResolvedValueOnce({ id: PROP_ID, availability: false });
    const app = await getApp();
    const res = await request(app)
      .post("/listings")
      .set("bg-api-key", "test-key")
      .send({
        propertyId: PROP_ID,
        listingType: "rent",
        title: "New",
        region: "NY",
        district: "Manhattan",
        type: "apartment",
        category: "rent",
        description: "D",
        features: [],
        details: [],
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/unavailable/);
  });

  it("POST /listings returns 400 when no price for property and type", async () => {
    fetchPriceAmountForTypeMock.mockResolvedValueOnce(null);
    const app = await getApp();
    const res = await request(app)
      .post("/listings")
      .set("bg-api-key", "test-key")
      .send({
        propertyId: PROP_ID,
        listingType: "rent",
        title: "New",
        region: "NY",
        district: "Manhattan",
        type: "apartment",
        category: "rent",
        description: "D",
        features: [],
        details: [],
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/price/);
  });

  it("POST /listings returns 201 with minimal payload (propertyId + listingType only)", async () => {
    const created = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      propertyId: PROP_ID,
      listingType: "rent",
      title: "123 Main St",
      region: "NY",
      district: "Manhattan",
      type: "apartment",
      category: "residential",
      price: 2500,
      rating: 0,
      description: "Spacious unit",
      features: ["parking"],
      details: [],
      image: "https://example.com/1.jpg",
      images: ["https://example.com/1.jpg"],
      status: "Active",
      address: "123 Main St",
      location: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockState.insertReturn = [created];
    const app = await getApp();
    const res = await request(app)
      .post("/listings")
      .set("bg-api-key", "test-key")
      .send({ propertyId: PROP_ID, listingType: "rent" });
    expect(res.status).toBe(201);
    expect(res.body.listingType).toBe("rent");
    expect(res.body.title).toBe("123 Main St");
    expect(res.body.region).toBe("NY");
    expect(res.body.price).toBe(2500);
    expect(fetchPropertyMock).toHaveBeenCalledWith(PROP_ID);
    expect(fetchPriceAmountForTypeMock).toHaveBeenCalledWith(PROP_ID, "rent");
  });

  it("POST /listings allows optional overrides over property data", async () => {
    const created = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      propertyId: PROP_ID,
      listingType: "sales",
      title: "Custom title",
      region: "NY",
      district: "Manhattan",
      type: "apartment",
      category: "residential",
      price: 3000,
      rating: 0,
      description: "Custom desc",
      features: ["parking", "pool"],
      details: [],
      image: "https://example.com/custom.jpg",
      images: ["https://example.com/custom.jpg"],
      status: "Active",
      address: "123 Main St",
      location: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockState.insertReturn = [created];
    fetchPriceAmountForTypeMock.mockResolvedValue(3000);
    const app = await getApp();
    const res = await request(app)
      .post("/listings")
      .set("bg-api-key", "test-key")
      .send({
        propertyId: PROP_ID,
        listingType: "sales",
        title: "Custom title",
        description: "Custom desc",
        features: ["parking", "pool"],
        image: "https://example.com/custom.jpg",
      });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Custom title");
    expect(res.body.description).toBe("Custom desc");
  });

  it("PUT /listings/:id returns 404 when not found", async () => {
    mockState.updateReturn = [];
    const app = await getApp();
    const res = await request(app)
      .put("/listings/550e8400-e29b-41d4-a716-446655440000")
      .set("bg-api-key", "test-key")
      .send({ title: "Updated", region: "NY", district: "M", type: "apartment", category: "rent", price: 3000, description: "D" });
    expect(res.status).toBe(404);
  });

  it("DELETE /listings/:id returns 404 when not found", async () => {
    mockState.deleteReturn = [];
    const app = await getApp();
    const res = await request(app).delete("/listings/550e8400-e29b-41d4-a716-446655440000").set("bg-api-key", "test-key");
    expect(res.status).toBe(404);
  });

  it("DELETE /listings/:id returns 204 when deleted", async () => {
    mockState.deleteReturn = [{ id: "550e8400-e29b-41d4-a716-446655440000" }];
    const app = await getApp();
    const res = await request(app).delete("/listings/550e8400-e29b-41d4-a716-446655440000").set("bg-api-key", "test-key");
    expect(res.status).toBe(204);
  });

  it("requests without bg-api-key are rejected when env is set", async () => {
    const prev = process.env.BG_API_Key;
    process.env.BG_API_Key = "required-key";
    try {
      const app = await getApp();
      const res = await request(app).get("/listings");
      expect(res.status).toBe(401);
    } finally {
      process.env.BG_API_Key = prev;
    }
  });
});
