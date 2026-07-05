import { pgTable, uuid, varchar, text, integer, real, jsonb, timestamp } from "drizzle-orm/pg-core";

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: varchar("status", { length: 50 }).notNull().default("Active"),
  type: varchar("type", { length: 50 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
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
  image: varchar("image", { length: 1024 }).notNull(),
  images: jsonb("images").$type<string[]>().default([]),
  location: jsonb("location").$type<{ type: "Point"; coordinates: [number, number]; formattedAddress?: string }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const inventory = pgTable("inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  availableQuantity: integer("available_quantity").notNull().default(1),
  unitType: varchar("unit_type", { length: 50 }).notNull().default("unit"),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  surname: varchar("surname", { length: 100 }).notNull(),
  employer: varchar("employer", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  listingId: uuid("listing_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Property = typeof properties.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type InventoryItem = typeof inventory.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
