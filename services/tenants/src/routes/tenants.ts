import { Router, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db, tenants as tenantsTable, listings as listingsTable } from "../db/index.js";
import { parsePagination, buildPaginationMeta } from "@realestate/shared";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
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
    if (body.listingId != null) updates.listingId = body.listingId;
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

router.delete("/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!isValidUuid(id)) {
    res.status(400).json({ error: "Invalid id: must be a valid UUID" });
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
});

export default router;
