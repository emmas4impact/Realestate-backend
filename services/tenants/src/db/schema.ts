import { pgTable, uuid, varchar, text, real, jsonb, timestamp } from "drizzle-orm/pg-core";

/** Listings table (same DB) - used to populate listing info in tenant responses */
export const listings = pgTable("listings", {
  id: uuid("id").primaryKey().defaultRandom(),
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
  location: jsonb("location").$type<{ type: "Point"; coordinates: [number, number]; formattedAddress?: string }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Tenants - reference listing by ID (listings in same DB) */
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

export type Listing = typeof listings.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
