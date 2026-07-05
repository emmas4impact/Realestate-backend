import { Router, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db, tenants as tenantsTable, listings as listingsTable } from "../db/index.js";
import { parsePagination, buildPaginationMeta } from "@realestate/shared";
import { consumeInventoryForProperty, releaseInventoryForProperty } from "../services/inventory.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

const LISTING_TYPES = ["rent", "sales"] as const;
type ListingType = (typeof LISTING_TYPES)[number];

function isValidListingType(value: unknown): value is ListingType {
  return typeof value === "string" && LISTING_TYPES.includes(value as ListingType);
}

interface ValidListing {
  propertyId: string;
}

async function findListingPropertyId(listingId: string, res: Response): Promise<string | null> {
  const [listing] = await db
    .select()
    .from(listingsTable)
    .where(eq(listingsTable.id, listingId))
    .limit(1);

  if (!listing) {
    res.status(404).json({ error: `Listing with id ${listingId} not found` });
    return null;
  }

  const propertyId = (listing as { propertyId?: string }).propertyId;
  if (!propertyId) {
    res.status(500).json({ error: "Listing is missing propertyId" });
    return null;
  }

  return propertyId;
}

async function validateListingType(listingId: string, listingType: ListingType, res: Response): Promise<ValidListing | null> {
  const [listing] = await db
    .select()
    .from(listingsTable)
    .where(eq(listingsTable.id, listingId))
    .limit(1);

  if (!listing) {
    res.status(404).json({ error: `Listing with id ${listingId} not found` });
    return null;
  }

  if ((listing as { listingType?: string }).listingType !== listingType) {
    res.status(409).json({ error: `Listing is not available for ${listingType}` });
    return null;
  }

  const propertyId = (listing as { propertyId?: string }).propertyId;
  if (!propertyId) {
    res.status(500).json({ error: "Listing is missing propertyId" });
    return null;
  }

  return { propertyId };
}

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const { page, limit, offset } = parsePagination(req.query as { page?: string; limit?: string });
  const listingId = req.query.listingId as string | undefined;
  if (listingId != null && listingId !== "" && !isValidUuid(listingId)) {
    res.status(400).json({ error: "Invalid listingId: must be a valid UUID" });
    return;
  }
  const where = listingId ? eq(tenantsTable.listingId, listingId) : undefined;
  const [data, countResult] = await Promise.all([
    db.select().from(tenantsTable).where(where).limit(limit).offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantsTable)
      .where(where)
      .then((r) => r[0]?.count ?? 0),
  ]);
  const total = typeof countResult === "number" ? countResult : (countResult as { count: number }).count;
  const meta = buildPaginationMeta(total, { page, limit, offset });
  res.json({ data, meta });
});

router.get("/listing/:listingId", async (req: Request, res: Response) => {
  const listingId = req.params.listingId;
  if (!isValidUuid(listingId)) {
    res.status(400).json({ error: "Invalid listingId: must be a valid UUID" });
    return;
  }
  const [listing] = await db
    .select()
    .from(listingsTable)
    .where(eq(listingsTable.id, listingId))
    .limit(1);
  if (!listing) {
    res.status(404).json({ error: `Listing with id ${listingId} not found` });
    return;
  }
  const tenants = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.listingId, listingId));
  const data = tenants.map((tenant) => ({
    tenant_info: tenant,
    listing,
  }));
  const meta = { count: data.length };
  res.json({ data, meta });
});

router.get("/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!isValidUuid(id)) {
    res.status(400).json({ error: "Invalid id: must be a valid UUID" });
    return;
  }
  const [row] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: `No tenant found with ID ${id}` });
    return;
  }
  res.json(row);
});

router.post("/", async (req: Request, res: Response, next) => {
  try {
    const body = req.body as Record<string, string>;
    if (!body.listingId || !isValidUuid(body.listingId)) {
      res.status(400).json({ error: "listingId is required and must be a valid UUID" });
      return;
    }
    if (!isValidListingType(body.listingType)) {
      res.status(400).json({ error: "listingType is required and must be one of: rent, sales" });
      return;
    }
    const listing = await validateListingType(body.listingId, body.listingType, res);
    if (!listing) {
      return;
    }

    const inventoryResult = await consumeInventoryForProperty(listing.propertyId);
    if (!inventoryResult.ok) {
      res.status(inventoryResult.status).json({ error: inventoryResult.message });
      return;
    }

    const [inserted] = await db
      .insert(tenantsTable)
      .values({
        name: body.name,
        surname: body.surname,
        employer: body.employer,
        phone: body.phone,
        email: body.email,
        listingId: body.listingId,
      })
      .returning();
    res.status(201).json(inserted);
  } catch (e) {
    next(e as Error);
  }
});

router.put("/:id", async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id;
    if (!isValidUuid(id)) {
      res.status(400).json({ error: "Invalid id: must be a valid UUID" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name != null) updates.name = body.name;
    if (body.surname != null) updates.surname = body.surname;
    if (body.employer != null) updates.employer = body.employer;
    if (body.phone != null) updates.phone = body.phone;
    if (body.email != null) updates.email = body.email;
    if (body.listingId != null) {
      if (typeof body.listingId !== "string" || !isValidUuid(body.listingId)) {
        res.status(400).json({ error: "listingId must be a valid UUID" });
        return;
      }
      if (!isValidListingType(body.listingType)) {
        res.status(400).json({ error: "listingType is required when changing listingId and must be one of: rent, sales" });
        return;
      }
      if (!(await validateListingType(body.listingId, body.listingType, res))) {
        return;
      }
      updates.listingId = body.listingId;
    }
    const [updated] = await db
      .update(tenantsTable)
      .set(updates as Record<string, unknown>)
      .where(eq(tenantsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: `Tenant with id ${id} not found` });
      return;
    }
    res.json(updated);
  } catch (e) {
    next(e as Error);
  }
});

router.delete("/:id", async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id;
    if (!isValidUuid(id)) {
      res.status(400).json({ error: "Invalid id: must be a valid UUID" });
      return;
    }

    const [tenant] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, id))
      .limit(1);
    if (!tenant) {
      res.status(404).json({ error: `Tenant with id ${id} not found` });
      return;
    }

    const listingId = (tenant as { listingId?: string }).listingId;
    if (!listingId) {
      res.status(500).json({ error: "Tenant is missing listingId" });
      return;
    }

    const propertyId = await findListingPropertyId(listingId, res);
    if (!propertyId) {
      return;
    }

    const inventoryResult = await releaseInventoryForProperty(propertyId);
    if (!inventoryResult.ok) {
      res.status(inventoryResult.status).json({ error: inventoryResult.message });
      return;
    }

    const [deleted] = await db
      .delete(tenantsTable)
      .where(eq(tenantsTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: `Tenant with id ${id} not found` });
      return;
    }
    res.status(204).send();
  } catch (e) {
    next(e as Error);
  }
});

export default router;
