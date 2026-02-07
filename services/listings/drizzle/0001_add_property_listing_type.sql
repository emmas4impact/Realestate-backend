-- Listings must reference a property; listingType is "rent" or "sales" (one required).
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "property_id" uuid;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "listing_type" varchar(50) NOT NULL DEFAULT 'rent';
