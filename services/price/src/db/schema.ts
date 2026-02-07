import { pgTable, uuid, varchar, real, timestamp } from "drizzle-orm/pg-core";

/**
 * Prices - pricing records per property (sale, rent, etc.).
 * Returned as array in property response when fetching by propertyId.
 */
export const prices = pgTable("prices", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull(),
  amount: real("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  type: varchar("type", { length: 50 }).notNull().default("sale"), // sale, rent, etc.
  start_at: timestamp("start_at"),
  end_at: timestamp("end_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Price = typeof prices.$inferSelect;
export type NewPrice = typeof prices.$inferInsert;
