import { pgTable, uuid, varchar, text, real, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Listings table - RESO-aligned; each listing links to a property and has a deal type (rent | sales).
 * Price is sourced from the price service by listingType.
 */
export const LISTING_TYPES = ["rent", "sales"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const listings = pgTable("listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull(),
  listingType: varchar("listing_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("Active"),
  title: varchar("title", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }),
  region: varchar("region", { length: 100 }).notNull(),
  district: varchar("district", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  price: real("price").notNull(),
  rating: real("rating").notNull().default(0),
  description: text("description").notNull(),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  details: jsonb("details").$type<string[]>().notNull().default([]),
  image: varchar("image", { length: 1024 }).notNull().default("https://img.fixthephoto.com/blog/images/gallery/news_image_212.jpg"),
  images: jsonb("images").$type<string[]>().default([]),
  location: jsonb("location").$type<{
    type: "Point";
    coordinates: [number, number];
    formattedAddress?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
