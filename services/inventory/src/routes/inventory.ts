import { Router, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db, inventory as inventoryTable } from "../db/index.js";
import { parsePagination, buildPaginationMeta } from "@realestate/shared";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

const router = Router();

// GET /inventory?propertyId=x - returns { data: [...] } for property (used by property service)
router.get("/", async (req: Request, res: Response) => {
  const propertyId = req.query.propertyId as string | undefined;
  if (propertyId != null && propertyId !== "" && !isValidUuid(propertyId)) {
    res.status(400).json({ error: "Invalid propertyId: must be a valid UUID" });
    return;
  }
  if (propertyId) {
    const data = await db
      .select()
      .from(inventoryTable)
      .where(eq(inventoryTable.propertyId, propertyId));
    res.json({ data });
    return;
  }
  const { page, limit, offset } = parsePagination(req.query as { page?: string; limit?: string });
  const [data, countResult] = await Promise.all([
    db.select().from(inventoryTable).limit(limit).offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventoryTable)
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
    .from(inventoryTable)
    .where(eq(inventoryTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: `No inventory item found with ID ${id}` });
    return;
  }
  res.json(row);
});

function parsePropertyId(body: Record<string, unknown>): string {
  const raw = body.propertyId ?? body.property_id ?? body.id;
  return typeof raw === "string" ? raw.trim() : "";
}

function toInventoryRow(body: Record<string, unknown>, propertyId: string) {
  const qty = Number(body.quantity) ?? 1;
  const available = body.availableQuantity != null ? Number(body.availableQuantity) : body.available_quantity != null ? Number(body.available_quantity) : qty;
  return {
    propertyId,
    quantity: qty,
    availableQuantity: Math.min(Math.max(0, available), qty),
    unitType: (body.unitType as string) ?? "unit",
    name: (body.name as string) ?? null,
  };
}

router.post("/", async (req: Request, res: Response, next) => {
  try {
    const body = req.body as Record<string, unknown> | Record<string, unknown>[];
    const raw =
      typeof body === "object" && body !== null && Array.isArray((body as Record<string, unknown>).inventory)
        ? (body as { inventory: Record<string, unknown>[] }).inventory
        : Array.isArray(body)
          ? body
          : [body];

    if (raw.length === 0) {
      res.status(400).json({ error: "Request body must be { inventory: [...] } or a single inventory object" });
      return;
    }

    const toInsert: { propertyId: string; quantity: number; availableQuantity: number; unitType: string; name: string | null }[] = [];
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i] as Record<string, unknown>;
      const propertyId = parsePropertyId(item);
      if (!propertyId || !isValidUuid(propertyId)) {
        res.status(400).json({ error: `Item ${i + 1}: valid propertyId is required (must be a valid UUID)` });
        return;
      }
      toInsert.push(toInventoryRow(item, propertyId));
    }

    const inserted = await db.insert(inventoryTable).values(toInsert).returning();
    const isMultiple = raw.length > 1 || (typeof body === "object" && body !== null && "inventory" in body);
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
    if (body.quantity != null) updates.quantity = Number(body.quantity);
    if (body.availableQuantity != null) updates.availableQuantity = Math.max(0, Number(body.availableQuantity));
    if (body.available_quantity != null) updates.availableQuantity = Math.max(0, Number(body.available_quantity));
    if (body.unitType != null) updates.unitType = body.unitType;
    if (body.name != null) updates.name = body.name;
    const [updated] = await db
      .update(inventoryTable)
      .set(updates as Record<string, unknown>)
      .where(eq(inventoryTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: `Inventory item with id ${id} not found` });
      return;
    }
    res.json(updated);
  } catch (e) {
    next(e as Error);
  }
});

router.patch("/:id/decrement-available", async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!isValidUuid(id)) {
    res.status(400).json({ error: "Invalid id: must be a valid UUID" });
    return;
  }
  const amount = Math.max(1, Math.floor(Number((req.body as Record<string, unknown>).amount) || 1));
  const [row] = await db
    .select()
    .from(inventoryTable)
    .where(eq(inventoryTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: `Inventory item with id ${id} not found` });
    return;
  }
  const current = (row as { availableQuantity: number }).availableQuantity ?? 0;
  const nextAvailable = Math.max(0, current - amount);
  const [updated] = await db
    .update(inventoryTable)
    .set({ availableQuantity: nextAvailable, updatedAt: new Date() })
    .where(eq(inventoryTable.id, id))
    .returning();
  res.json(updated);
});

router.delete("/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!isValidUuid(id)) {
    res.status(400).json({ error: "Invalid id: must be a valid UUID" });
    return;
  }
  const [deleted] = await db
    .delete(inventoryTable)
    .where(eq(inventoryTable.id, id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: `Inventory item with id ${id} not found` });
    return;
  }
  res.status(204).send();
});

export default router;
