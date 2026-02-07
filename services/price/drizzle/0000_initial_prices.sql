CREATE TABLE IF NOT EXISTS "prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"amount" real NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"type" varchar(50) DEFAULT 'sale' NOT NULL,
	"start_at" timestamp,
	"end_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
