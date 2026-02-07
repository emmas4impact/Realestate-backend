import { pgTable, uuid, varchar, text, integer, real, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Properties - physical real estate assets (building, land, etc.).
 * Listings reference properties; inventory and prices are per-property.
 */
export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: varchar("status", { length: 50 }).notNull().default("Active"),
  type: varchar("type", { length: 50 }).notNull(), // residential, commercial, land, mixed
  category: varchar("category", { length: 50 }).notNull(), // house, apartment, lot, etc.
  address: varchar("address", { length: 500 }),
  region: varchar("region", { length: 100 }).notNull(),
  district: varchar("district", { length: 100 }).notNull(),
  sizeSqft: real("size_sqft"),
  lotSizeSqft: real("lot_sqft"),
  bedrooms: integer("bedrooms"),
  bathrooms: real("bathrooms"),
  yearBuilt: integer("year_built"),
  description: text("description").notNull().default(""),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  images: jsonb("images").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
