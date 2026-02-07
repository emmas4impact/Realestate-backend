import { pgTable, uuid, varchar, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Inventory - quantity/units per property (e.g. number of houses, units).
 * Returned as array in property response when fetching by propertyId.
 */
export const inventory = pgTable("inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  availableQuantity: integer("available_quantity").notNull().default(1), // decrements when unit is rented/sold; starts equal to quantity
  unitType: varchar("unit_type", { length: 50 }).notNull().default("unit"), // house, apartment, lot, etc.
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InventoryItem = typeof inventory.$inferSelect;
export type NewInventoryItem = typeof inventory.$inferInsert;
