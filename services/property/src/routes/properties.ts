import { Router, type Request, type Response } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, properties as propertiesTable } from "../db/index.js";
import { parsePagination, buildPaginationMeta } from "@realestate/shared";
import { fetchInventoryForProperty, fetchPricesForProperty } from "../services/fetchInventoryAndPrices.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/** Compute availability from inventory: true if any item has availableQuantity > 0 */
function availabilityFromInventory(inventory: unknown[]): boolean {
  if (!Array.isArray(inventory) || inventory.length === 0) return false;
  return inventory.some((item: unknown) => {
    const r = item as Record<string, unknown>;
    const q = r?.availableQuantity ?? r?.available_quantity;
    return typeof q === "number" && q > 0;
  });
}

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const { page, limit, offset } = parsePagination(req.query as { page?: string; limit?: string });
  const district = req.query.district as string | undefined;
  const region = req.query.region as string | undefined;
  const type = req.query.type as string | undefined;
  const conditions = [];
  if (district) conditions.push(eq(propertiesTable.district, district));
  if (region) conditions.push(eq(propertiesTable.region, region));
  if (type) conditions.push(eq(propertiesTable.type, type));
  const where = conditions.length ? and(...conditions) : undefined;

  const orderBy = desc(propertiesTable.createdAt);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(propertiesTable)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(propertiesTable)
      .where(where)
      .then((r) => r[0]?.count ?? 0),
  ]);

  const total = typeof countResult === "number" ? countResult : (countResult as { count: number }).count;
  const meta = buildPaginationMeta(total, { page, limit, offset });

  const dataWithArrays = await Promise.all(
    data.map(async (p) => {
      const id = (p as { id: string }).id;
      const [inventory, prices] = await Promise.all([
        fetchInventoryForProperty(id),
        fetchPricesForProperty(id),
      ]);
      const inv = inventory ?? [];
      return { ...p, inventory: inv, prices: prices ?? [], availability: availabilityFromInventory(inv) };
    })
  );
  res.json({ data: dataWithArrays, meta });
});

router.get("/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!isValidUuid(id)) {
    res.status(400).json({ error: "Invalid id: must be a valid UUID" });
    return;
  }
  const [row] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: `No property found with ID ${id}` });
    return;
  }
  const [inventory, prices] = await Promise.all([
    fetchInventoryForProperty(id),
    fetchPricesForProperty(id),
  ]);
  const inv = inventory ?? [];
  res.json({
    ...row,
    inventory: inv,
    prices: prices ?? [],
    availability: availabilityFromInventory(inv),
  });
});

router.post("/", async (req: Request, res: Response, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const [inserted] = await db
      .insert(propertiesTable)
      .values({
        status: (body.status as string) ?? "Active",
        type: body.type as string,
        category: body.category as string,
        address: (body.address as string) ?? null,
        region: body.region as string,
        district: body.district as string,
        sizeSqft: body.sizeSqft != null ? Number(body.sizeSqft) : null,
        lotSizeSqft: body.lotSizeSqft != null ? Number(body.lotSizeSqft) : null,
        bedrooms: body.bedrooms != null ? Number(body.bedrooms) : null,
        bathrooms: body.bathrooms != null ? Number(body.bathrooms) : null,
        yearBuilt: body.yearBuilt != null ? Number(body.yearBuilt) : null,
        description: (body.description as string) ?? "",
        features: Array.isArray(body.features) ? (body.features as string[]) : [],
        images: Array.isArray(body.images) ? (body.images as string[]) : [],
      })
      .returning();
    if (!inserted) {
      res.status(500).json({ error: "Insert failed" });
      return;
    }
    res.status(201).json({ ...inserted, inventory: [], prices: [], availability: false });
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
    const updates: Record<string, unknown> = {
      status: body.status,
      type: body.type,
      category: body.category,
      address: body.address,
      region: body.region,
      district: body.district,
      sizeSqft: body.sizeSqft != null ? Number(body.sizeSqft) : undefined,
      lotSizeSqft: body.lotSizeSqft != null ? Number(body.lotSizeSqft) : undefined,
      bedrooms: body.bedrooms != null ? Number(body.bedrooms) : undefined,
      bathrooms: body.bathrooms != null ? Number(body.bathrooms) : undefined,
      yearBuilt: body.yearBuilt != null ? Number(body.yearBuilt) : undefined,
      description: body.description,
      features: body.features,
      images: body.images,
      updatedAt: new Date(),
    };
    Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);
    const [updated] = await db
      .update(propertiesTable)
      .set(updates as Record<string, unknown>)
      .where(eq(propertiesTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: `Property with id ${id} not found` });
      return;
    }
    const [inventory, prices] = await Promise.all([
      fetchInventoryForProperty(id),
      fetchPricesForProperty(id),
    ]);
    const inv = inventory ?? [];
    res.json({ ...updated, inventory: inv, prices: prices ?? [], availability: availabilityFromInventory(inv) });
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
    .delete(propertiesTable)
    .where(eq(propertiesTable.id, id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: `Property with id ${id} not found` });
    return;
  }
  res.status(204).send();
});

export default router;
