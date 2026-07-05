import { Router, type Request, type Response } from "express";
import { desc } from "drizzle-orm";
import {
  db,
  properties as propertiesTable,
  listings as listingsTable,
  inventory as inventoryTable,
  tenants as tenantsTable,
  type Property,
  type Listing,
  type InventoryItem,
  type Tenant,
} from "../db/index.js";
import { parsePagination, buildPaginationMeta } from "@realestate/shared";

const SEARCH_BUFFER = 3;
const SEARCH_MODES = ["soft", "hard"] as const;
type SearchMode = (typeof SEARCH_MODES)[number];

interface SearchContext {
  properties: Property[];
  listings: Listing[];
  inventory: InventoryItem[];
  tenants: Tenant[];
  inventoryByProperty: Map<string, InventorySummary>;
  tenantsByListing: Map<string, Tenant[]>;
  listingsById: Map<string, Listing>;
}

interface InventorySummary {
  quantity: number;
  availableQuantity: number;
  items: InventoryItem[];
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function readMode(value: unknown): SearchMode {
  return value === "hard" ? "hard" : "soft";
}

function searchableText(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(searchableText).join(" ");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map(searchableText).join(" ");
  return String(value);
}

function fieldMatches(value: unknown, query: string | undefined, mode: SearchMode): boolean {
  if (!query) return true;
  const target = searchableText(value).toLowerCase();
  const normalized = query.toLowerCase();
  if (mode === "hard") {
    return target.split(/\s+/).some((part) => part === normalized) || target === normalized;
  }
  const buffered = normalized.slice(0, Math.max(SEARCH_BUFFER, Math.min(normalized.length, SEARCH_BUFFER)));
  return buffered.length >= SEARCH_BUFFER ? target.includes(buffered) : target.includes(normalized);
}

function rowMatches(row: Record<string, unknown>, query: string | undefined, mode: SearchMode): boolean {
  if (!query) return true;
  return fieldMatches(Object.values(row), query, mode);
}

function paginate<T>(rows: T[], req: Request): { data: T[]; meta: ReturnType<typeof buildPaginationMeta> } {
  const { page, limit, offset } = parsePagination(req.query as { page?: string; limit?: string });
  return {
    data: rows.slice(offset, offset + limit),
    meta: buildPaginationMeta(rows.length, { page, limit, offset }),
  };
}

function summarizeInventory(items: InventoryItem[]): InventorySummary {
  return {
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    availableQuantity: items.reduce((sum, item) => sum + item.availableQuantity, 0),
    items,
  };
}

function buildMapByProperty(inventory: InventoryItem[]): Map<string, InventorySummary> {
  const grouped = new Map<string, InventoryItem[]>();
  for (const item of inventory) {
    const rows = grouped.get(item.propertyId) ?? [];
    rows.push(item);
    grouped.set(item.propertyId, rows);
  }
  return new Map(Array.from(grouped.entries()).map(([propertyId, items]) => [propertyId, summarizeInventory(items)]));
}

function buildTenantsByListing(tenants: Tenant[]): Map<string, Tenant[]> {
  const grouped = new Map<string, Tenant[]>();
  for (const tenant of tenants) {
    const rows = grouped.get(tenant.listingId) ?? [];
    rows.push(tenant);
    grouped.set(tenant.listingId, rows);
  }
  return grouped;
}

async function loadContext(): Promise<SearchContext> {
  const [properties, listings, inventory, tenants] = await Promise.all([
    db.select().from(propertiesTable).orderBy(desc(propertiesTable.createdAt)),
    db.select().from(listingsTable).orderBy(desc(listingsTable.createdAt)),
    db.select().from(inventoryTable),
    db.select().from(tenantsTable).orderBy(desc(tenantsTable.createdAt)),
  ]);

  return {
    properties,
    listings,
    inventory,
    tenants,
    inventoryByProperty: buildMapByProperty(inventory),
    tenantsByListing: buildTenantsByListing(tenants),
    listingsById: new Map(listings.map((listing) => [listing.id, listing])),
  };
}

function propertyView(property: Property, context: SearchContext) {
  const inventory = context.inventoryByProperty.get(property.id) ?? { quantity: 0, availableQuantity: 0, items: [] };
  const listings = context.listings.filter((listing) => listing.propertyId === property.id);
  const tenantCount = listings.reduce((sum, listing) => sum + (context.tenantsByListing.get(listing.id)?.length ?? 0), 0);
  return {
    ...property,
    availability: inventory.availableQuantity > 0,
    inventory: {
      quantity: inventory.quantity,
      availableQuantity: inventory.availableQuantity,
      items: inventory.items,
    },
    listings,
    tenantStatus: tenantCount > 0 ? "occupied" : "vacant",
    tenantCount,
  };
}

function listingView(listing: Listing, context: SearchContext) {
  const inventory = context.inventoryByProperty.get(listing.propertyId) ?? { quantity: 0, availableQuantity: 0, items: [] };
  const tenants = context.tenantsByListing.get(listing.id) ?? [];
  return {
    ...listing,
    availability: inventory.availableQuantity > 0,
    inventory: {
      quantity: inventory.quantity,
      availableQuantity: inventory.availableQuantity,
    },
    tenantStatus: tenants.length > 0 ? "occupied" : "vacant",
    tenantCount: tenants.length,
  };
}

function tenantView(tenant: Tenant, context: SearchContext) {
  const listing = context.listingsById.get(tenant.listingId);
  return {
    ...tenant,
    status: listing ? "active" : "listing_missing",
    listing: listing ? listingView(listing, context) : null,
  };
}

function filterProperties(context: SearchContext, req: Request) {
  const mode = readMode(req.query.mode);
  const q = readString(req.query.q);
  const status = readString(req.query.status);
  const type = readString(req.query.type);
  const category = readString(req.query.category);
  const region = readString(req.query.region);
  const district = readString(req.query.district);
  const availability = readBoolean(req.query.availability);

  return context.properties
    .map((property) => propertyView(property, context))
    .filter((property) => rowMatches(property, q, mode))
    .filter((property) => !status || fieldMatches(property.status, status, "hard"))
    .filter((property) => !type || fieldMatches(property.type, type, "hard"))
    .filter((property) => !category || fieldMatches(property.category, category, "hard"))
    .filter((property) => !region || fieldMatches(property.region, region, mode))
    .filter((property) => !district || fieldMatches(property.district, district, mode))
    .filter((property) => availability === undefined || property.availability === availability);
}

function filterListings(context: SearchContext, req: Request) {
  const mode = readMode(req.query.mode);
  const q = readString(req.query.q);
  const status = readString(req.query.status);
  const listingType = readString(req.query.listingType);
  const availability = readBoolean(req.query.availability);
  const tenantStatus = readString(req.query.tenantStatus);

  return context.listings
    .map((listing) => listingView(listing, context))
    .filter((listing) => rowMatches(listing, q, mode))
    .filter((listing) => !status || fieldMatches(listing.status, status, "hard"))
    .filter((listing) => !listingType || fieldMatches(listing.listingType, listingType, "hard"))
    .filter((listing) => !tenantStatus || listing.tenantStatus === tenantStatus)
    .filter((listing) => availability === undefined || listing.availability === availability);
}

function filterTenants(context: SearchContext, req: Request) {
  const mode = readMode(req.query.mode);
  const q = readString(req.query.q);
  const status = readString(req.query.status);

  return context.tenants
    .map((tenant) => tenantView(tenant, context))
    .filter((tenant) => rowMatches(tenant, q, mode))
    .filter((tenant) => !status || tenant.status === status);
}

const router = Router();

router.get("/", async (req: Request, res: Response, next) => {
  try {
    const context = await loadContext();
    res.json({
      query: {
        q: readString(req.query.q) ?? null,
        mode: readMode(req.query.mode),
        buffer: SEARCH_BUFFER,
      },
      data: {
        properties: filterProperties(context, req),
        listings: filterListings(context, req),
        tenants: filterTenants(context, req),
      },
    });
  } catch (e) {
    next(e as Error);
  }
});

router.get("/properties", async (req: Request, res: Response, next) => {
  try {
    const result = paginate(filterProperties(await loadContext(), req), req);
    res.json(result);
  } catch (e) {
    next(e as Error);
  }
});

router.get("/availability", async (req: Request, res: Response, next) => {
  try {
    const context = await loadContext();
    const rows = filterProperties(context, req).map((property) => ({
      id: property.id,
      status: property.status,
      type: property.type,
      category: property.category,
      address: property.address,
      region: property.region,
      district: property.district,
      availability: property.availability,
      quantity: property.inventory.quantity,
      availableQuantity: property.inventory.availableQuantity,
      tenantStatus: property.tenantStatus,
      tenantCount: property.tenantCount,
    }));
    res.json(paginate(rows, req));
  } catch (e) {
    next(e as Error);
  }
});

router.get("/listings", async (req: Request, res: Response, next) => {
  try {
    res.json(paginate(filterListings(await loadContext(), req), req));
  } catch (e) {
    next(e as Error);
  }
});

router.get("/tenants", async (req: Request, res: Response, next) => {
  try {
    res.json(paginate(filterTenants(await loadContext(), req), req));
  } catch (e) {
    next(e as Error);
  }
});

router.get("/status", async (req: Request, res: Response, next) => {
  try {
    const context = await loadContext();
    const properties = filterProperties(context, req);
    const listings = filterListings(context, req);
    const tenants = filterTenants(context, req);
    res.json({
      data: {
        properties: {
          total: properties.length,
          available: properties.filter((property) => property.availability).length,
          unavailable: properties.filter((property) => !property.availability).length,
          occupied: properties.filter((property) => property.tenantStatus === "occupied").length,
          vacant: properties.filter((property) => property.tenantStatus === "vacant").length,
        },
        listings: {
          total: listings.length,
          rent: listings.filter((listing) => listing.listingType === "rent").length,
          sales: listings.filter((listing) => listing.listingType === "sales").length,
          occupied: listings.filter((listing) => listing.tenantStatus === "occupied").length,
          vacant: listings.filter((listing) => listing.tenantStatus === "vacant").length,
        },
        tenants: {
          total: tenants.length,
          active: tenants.filter((tenant) => tenant.status === "active").length,
          listingMissing: tenants.filter((tenant) => tenant.status === "listing_missing").length,
        },
      },
    });
  } catch (e) {
    next(e as Error);
  }
});

export default router;
