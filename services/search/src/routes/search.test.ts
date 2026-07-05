import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const mockState = {
  properties: [] as Record<string, unknown>[],
  listings: [] as Record<string, unknown>[],
  inventory: [] as Record<string, unknown>[],
  tenants: [] as Record<string, unknown>[],
};

vi.mock("drizzle-orm", () => ({
  desc: vi.fn((value: unknown) => value),
}));

vi.mock("../db/index.js", () => {
  const properties = { table: "properties", createdAt: "properties.createdAt" };
  const listings = { table: "listings", createdAt: "listings.createdAt" };
  const inventory = { table: "inventory" };
  const tenants = { table: "tenants", createdAt: "tenants.createdAt" };
  const dataFor = (table: { table: string }) => {
    if (table === properties) return mockState.properties;
    if (table === listings) return mockState.listings;
    if (table === inventory) return mockState.inventory;
    if (table === tenants) return mockState.tenants;
    return [];
  };
  return {
    db: {
      select: () => ({
        from: (table: { table: string }) => ({
          orderBy: () => Promise.resolve(dataFor(table)),
          then: (fn: (rows: unknown[]) => unknown) => Promise.resolve(dataFor(table)).then(fn),
        }),
      }),
    },
    properties,
    listings,
    inventory,
    tenants,
  };
});

const getApp = async () => (await import("../app.js")).default;

describe("Search routes", () => {
  beforeEach(() => {
    mockState.properties = [
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        status: "Active",
        type: "residential",
        category: "apartment",
        address: "1 Marina Road",
        region: "Lagos",
        district: "Ikoyi",
        description: "Lagoon view apartment",
        features: ["balcony"],
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockState.listings = [
      {
        id: "550e8400-e29b-41d4-a716-446655440002",
        propertyId: "550e8400-e29b-41d4-a716-446655440001",
        listingType: "rent",
        status: "Active",
        title: "Ikoyi Apartment",
        address: "1 Marina Road",
        region: "Lagos",
        district: "Ikoyi",
        type: "residential",
        category: "apartment",
        price: 5000,
        rating: 0,
        description: "Ready to rent",
        features: [],
        details: [],
        image: "",
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockState.inventory = [
      {
        id: "550e8400-e29b-41d4-a716-446655440003",
        propertyId: "550e8400-e29b-41d4-a716-446655440001",
        quantity: 5,
        availableQuantity: 3,
        unitType: "apartment",
        name: "3-bedroom apartment units",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockState.tenants = [
      {
        id: "550e8400-e29b-41d4-a716-446655440004",
        name: "Kacie",
        surname: "Greenholt",
        employer: "Acme",
        phone: "123",
        email: "kacie@test.com",
        listingId: "550e8400-e29b-41d4-a716-446655440002",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  it("GET /search returns grouped results", async () => {
    const app = await getApp();
    const res = await request(app).get("/search?q=iko");
    expect(res.status).toBe(200);
    expect(res.body.data.properties).toHaveLength(1);
    expect(res.body.data.listings).toHaveLength(1);
    expect(res.body.data.tenants).toHaveLength(1);
  });

  it("GET /search/properties supports soft 3-letter matching and availability", async () => {
    const app = await getApp();
    const res = await request(app).get("/search/properties?q=apa&availability=true");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].inventory.availableQuantity).toBe(3);
    expect(res.body.data[0].tenantStatus).toBe("occupied");
  });

  it("GET /search/listings filters by listing type and tenant status", async () => {
    const app = await getApp();
    const res = await request(app).get("/search/listings?listingType=rent&tenantStatus=occupied");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("GET /search/tenants returns tenant status", async () => {
    const app = await getApp();
    const res = await request(app).get("/search/tenants?q=kac");
    expect(res.status).toBe(200);
    expect(res.body.data[0].status).toBe("active");
  });

  it("GET /search/status returns summary", async () => {
    const app = await getApp();
    const res = await request(app).get("/search/status");
    expect(res.status).toBe(200);
    expect(res.body.data.properties.available).toBe(1);
    expect(res.body.data.tenants.active).toBe(1);
  });
});
