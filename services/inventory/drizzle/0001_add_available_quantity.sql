-- Add available_quantity (default 1), then backfill existing rows so available = quantity
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "available_quantity" integer DEFAULT 1 NOT NULL;
UPDATE "inventory" SET "available_quantity" = "quantity";
