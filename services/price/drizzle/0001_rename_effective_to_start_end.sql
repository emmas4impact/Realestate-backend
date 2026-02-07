-- Rename effective_from/effective_to to start_at/end_at (only if old migration was applied)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'prices' AND column_name = 'effective_from') THEN
    ALTER TABLE "prices" RENAME COLUMN "effective_from" TO "start_at";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'prices' AND column_name = 'effective_to') THEN
    ALTER TABLE "prices" RENAME COLUMN "effective_to" TO "end_at";
  END IF;
END $$;
