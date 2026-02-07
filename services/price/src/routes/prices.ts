import { Router, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db, prices as pricesTable } from "../db/index.js";
import { parsePagination, buildPaginationMeta } from "@realestate/shared";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

const router = Router();

// GET /prices?propertyId=x - returns { data: [...] } for property (used by property service)
router.get("/", async (req: Request, res: Response) => {
  const propertyId = req.query.propertyId as string | undefined;
  if (propertyId != null && propertyId !== "" && !isValidUuid(propertyId)) {
    res.status(400).json({ error: "Invalid propertyId: must be a valid UUID" });
    return;
  }
  if (propertyId) {
    const data = await db
      .select()
      .from(pricesTable)
      .where(eq(pricesTable.propertyId, propertyId));
    res.json({ data });
    return;
  }
  const { page, limit, offset } = parsePagination(req.query as { page?: string; limit?: string });
  const [data, countResult] = await Promise.all([
    db.select().from(pricesTable).limit(limit).offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(pricesTable)
      .then((r) => r[0]?.count ?? 0),
  ]);
  const total = typeof countResult === "number" ? countResult : (countResult as { count: number }).count;
  const meta = buildPaginationMeta(total, { page, limit, offset });
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
    .from(pricesTable)
    .where(eq(pricesTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: `No price record found with ID ${id}` });
    return;
  }
  res.json(row);
});

function parsePropertyId(body: Record<string, unknown>): string {
  const raw = body.propertyId ?? body.property_id ?? body.id;
  return typeof raw === "string" ? raw.trim() : "";
}

function toPriceRow(body: Record<string, unknown>, propertyId: string) {
  return {
    propertyId,
    amount: Number(body.amount),
    currency: (body.currency as string) ?? "USD",
    type: (body.type as string) ?? "sale",
    start_at: body.start_at != null ? new Date(body.start_at as string) : body.startAt != null ? new Date(body.startAt as string) : null,
    end_at: body.end_at != null ? new Date(body.end_at as string) : body.endAt != null ? new Date(body.endAt as string) : null,
  };
}

router.post("/", async (req: Request, res: Response, next) => {
  try {
    const body = req.body as Record<string, unknown> | Record<string, unknown>[];
    const raw =
      typeof body === "object" && body !== null && Array.isArray((body as Record<string, unknown>).prices)
        ? (body as { prices: Record<string, unknown>[] }).prices
        : Array.isArray(body)
          ? body
          : [body];

    if (raw.length === 0) {
      res.status(400).json({ error: "Request body must be { prices: [...] } or a single price object" });
      return;
    }

    const toInsert: { propertyId: string; amount: number; currency: string; type: string; start_at: Date | null; end_at: Date | null }[] = [];
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i] as Record<string, unknown>;
      const propertyId = parsePropertyId(item);
      if (!propertyId || !isValidUuid(propertyId)) {
        res.status(400).json({ error: `Item ${i + 1}: valid propertyId is required (must be a valid UUID)` });
        return;
      }
      toInsert.push(toPriceRow(item, propertyId));
    }

    const inserted = await db.insert(pricesTable).values(toInsert).returning();
    const isMultiple = raw.length > 1 || (typeof body === "object" && body !== null && "prices" in body);
    res.status(201).json(isMultiple ? { data: inserted } : inserted[0]);
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
    if (body.propertyId != null) updates.propertyId = body.propertyId;
    if (body.amount != null) updates.amount = Number(body.amount);
    if (body.currency != null) updates.currency = body.currency;
    if (body.type != null) updates.type = body.type;
    if (body.start_at != null) updates.start_at = new Date(body.start_at as string);
    if (body.startAt != null) updates.start_at = new Date(body.startAt as string);
    if (body.end_at != null) updates.end_at = new Date(body.end_at as string);
    if (body.endAt != null) updates.end_at = new Date(body.endAt as string);
    const [updated] = await db
      .update(pricesTable)
      .set(updates as Record<string, unknown>)
      .where(eq(pricesTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: `Price record with id ${id} not found` });
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
    .delete(pricesTable)
    .where(eq(pricesTable.id, id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: `Price record with id ${id} not found` });
    return;
  }
  res.status(204).send();
});

export default router;
