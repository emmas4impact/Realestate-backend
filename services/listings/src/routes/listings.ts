import { Router, type Request, type Response } from "express";
import { eq, and, gte, lte, sql, desc, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { listings as listingsTable, LISTING_TYPES, type ListingType } from "../db/schema.js";
import { parsePagination, buildPaginationMeta } from "@realestate/shared";
import { geocodeAddress } from "../services/geocoder.js";
import { fetchProperty, fetchPriceAmountForType } from "../services/fetchPropertyAndPrice.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function isValidListingType(value: unknown): value is ListingType {
  return typeof value === "string" && LISTING_TYPES.includes(value as ListingType);
}

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const { page, limit, offset } = parsePagination(req.query as { page?: string; limit?: string });
  const district = req.query.district as string | undefined;
  const region = req.query.region as string | undefined;
  const listingType = req.query.listingType as string | undefined;
  const minPrice = req.query.minPrice != null ? Number(req.query.minPrice) : undefined;
  const maxPrice = req.query.maxPrice != null ? Number(req.query.maxPrice) : undefined;
  const sort = (req.query.sort as string) || "date_desc";

  const conditions = [];
  if (district) conditions.push(eq(listingsTable.district, district));
  if (region) conditions.push(eq(listingsTable.region, region));
  if (listingType && isValidListingType(listingType)) conditions.push(eq(listingsTable.listingType, listingType));
  if (minPrice != null) conditions.push(gte(listingsTable.price, minPrice));
  if (maxPrice != null) conditions.push(lte(listingsTable.price, maxPrice));
  const where = conditions.length ? and(...conditions) : undefined;

  const orderBy =
    sort === "price_asc"
      ? asc(listingsTable.price)
      : sort === "price_desc"
        ? desc(listingsTable.price)
        : desc(listingsTable.createdAt);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(listingsTable)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(listingsTable)
      .where(where)
      .then((r) => r[0]?.count ?? 0),
  ]);

  const total = typeof countResult === "number" ? countResult : (countResult as { count: number }).count;
  const meta = buildPaginationMeta(total, { page, limit, offset });
  res.json({ data, meta });
});

router.get("/price/range", async (req: Request, res: Response) => {
  const minPrice = Number(req.query.minPrice);
  const maxPrice = Number(req.query.maxPrice);
  if (Number.isNaN(minPrice) || Number.isNaN(maxPrice)) {
    res.status(400).json({ error: "minPrice and maxPrice required" });
    return;
  }
  const { page, limit, offset } = parsePagination(req.query as { page?: string; limit?: string });
  const data = await db
    .select()
    .from(listingsTable)
    .where(and(gte(listingsTable.price, minPrice), lte(listingsTable.price, maxPrice)))
    .orderBy(asc(listingsTable.price))
    .limit(limit)
    .offset(offset);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listingsTable)
    .where(and(gte(listingsTable.price, minPrice), lte(listingsTable.price, maxPrice)));
  const total = count ?? 0;
  const meta = buildPaginationMeta(total, { page, limit, offset });
  res.json({ data, meta });
});

router.get("/districts/:district", async (req: Request, res: Response) => {
  const data = await db
    .select()
    .from(listingsTable)
    .where(eq(listingsTable.district, req.params.district));
  res.json({ data, count: data.length });
});

router.get("/:id", async (req: Request, res: Response) => {
  const [row] = await db
    .select()
    .from(listingsTable)
    .where(eq(listingsTable.id, req.params.id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: `No listing found with ID ${req.params.id}` });
    return;
  }
  res.json(row);
});

router.post("/", async (req: Request, res: Response, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const propertyId = body.propertyId as string | undefined;
    const listingTypeRaw = body.listingType as unknown;

    if (!propertyId || !isValidUuid(propertyId)) {
      res.status(400).json({ error: "propertyId is required and must be a valid UUID" });
      return;
    }
    if (!isValidListingType(listingTypeRaw)) {
      res.status(400).json({ error: "listingType is required and must be one of: rent, sales" });
      return;
    }

    const property = await fetchProperty(propertyId);
    if (!property) {
      res.status(404).json({ error: "Property not found" });
      return;
    }
    if (property.availability !== true) {
      res.status(409).json({ error: "Property currently unavailable" });
      return;
    }

    const priceAmount = await fetchPriceAmountForType(propertyId, listingTypeRaw);
    if (priceAmount == null) {
      res.status(400).json({ error: "No price found for this property and listing type" });
      return;
    }

    const addr = (body.address as string) ?? (property.address as string) ?? "";
    const region = (body.region as string) ?? (property.region as string) ?? "";
    const district = (body.district as string) ?? (property.district as string) ?? "";
    const type = (body.type as string) ?? (property.type as string) ?? "";
    const category = (body.category as string) ?? (property.category as string) ?? "";
    const description = (body.description as string) ?? (property.description as string) ?? "";
    const propFeatures = Array.isArray(property.features) ? property.features as string[] : [];
    const features = Array.isArray(body.features) ? (body.features as string[]) : propFeatures;
    const propImages = Array.isArray(property.images) ? property.images as string[] : [];
    const images = Array.isArray(body.images) ? (body.images as string[]) : propImages;
    const defaultTitle = (property.address as string) || `Property in ${region}`;
    const title = (body.title as string) ?? defaultTitle;
    const details = Array.isArray(body.details) ? (body.details as string[]) : [];
    const defaultImage = "https://img.fixthephoto.com/blog/images/gallery/news_image_212.jpg";
    const image = (body.image as string) ?? (images[0] as string) ?? defaultImage;
    const location = addr ? await geocodeAddress(addr) : null;

    const [inserted] = await db
      .insert(listingsTable)
      .values({
        propertyId,
        listingType: listingTypeRaw,
        title,
        address: addr || null,
        region,
        district,
        type,
        category,
        price: priceAmount,
        rating: Number(body.rating) ?? 0,
        description,
        features,
        details,
        image,
        images,
        location: location ?? undefined,
      })
      .returning();
    res.status(201).json(inserted);
  } catch (e) {
    next(e as Error);
  }
});

router.put("/:id", async (req: Request, res: Response, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const [current] = await db.select().from(listingsTable).where(eq(listingsTable.id, req.params.id)).limit(1);
    if (!current) {
      res.status(404).json({ error: `Listing with id ${req.params.id} not found` });
      return;
    }

    const address = body.address as string | undefined;
    const location = address ? await geocodeAddress(address) : undefined;
    const newPropertyId = body.propertyId as string | undefined;
    const newListingType = body.listingType as unknown;
    const propertyId = newPropertyId ?? current.propertyId;
    const listingType = isValidListingType(newListingType) ? newListingType : (current.listingType as string);

    const updatePayload: Record<string, unknown> = {
      title: body.title,
      region: body.region,
      district: body.district,
      type: body.type,
      category: body.category,
      price: body.price,
      rating: body.rating,
      description: body.description,
      features: body.features,
      details: body.details,
      image: body.image,
      images: body.images,
      updatedAt: new Date(),
    };
    if (address != null) updatePayload.address = address;
    if (location) updatePayload.location = location;
    if (newPropertyId != null) {
      if (!isValidUuid(newPropertyId)) {
        res.status(400).json({ error: "propertyId must be a valid UUID" });
        return;
      }
      updatePayload.propertyId = newPropertyId;
    }
    if (isValidListingType(newListingType)) updatePayload.listingType = newListingType;

    if (newPropertyId != null || newListingType != null) {
      const property = await fetchProperty(propertyId);
      if (!property) {
        res.status(404).json({ error: "Property not found" });
        return;
      }
      if (property.availability !== true) {
        res.status(409).json({ error: "Property currently unavailable" });
        return;
      }
      const priceAmount = await fetchPriceAmountForType(propertyId, listingType);
      if (priceAmount == null) {
        res.status(400).json({ error: "No price found for this property and listing type" });
        return;
      }
      updatePayload.price = priceAmount;
    }

    const [updated] = await db
      .update(listingsTable)
      .set(updatePayload as Record<string, unknown>)
      .where(eq(listingsTable.id, req.params.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: `Listing with id ${req.params.id} not found` });
      return;
    }
    res.json(updated);
  } catch (e) {
    next(e as Error);
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  const [deleted] = await db
    .delete(listingsTable)
    .where(eq(listingsTable.id, req.params.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: `Record with id ${req.params.id} not found` });
    return;
  }
  res.status(204).send();
});

export default router;
