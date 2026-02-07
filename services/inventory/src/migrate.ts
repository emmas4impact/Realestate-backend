import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function run() {
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const { db } = await import("./db/index.js");
  const migrationsFolder = path.resolve(__dirname, "..", "drizzle");
  await migrate(db, { migrationsFolder, migrationsTable: "__drizzle_migrations_inventory" });
  console.log("Inventory migrations applied.");
  process.exit(0);
}
run().catch((e: NodeJS.ErrnoException) => {
  if (e.code === "ECONNREFUSED") {
    console.error("Migration failed: cannot connect to PostgreSQL. Start the database first, e.g.:");
    console.error("  docker compose up -d postgres");
    console.error("Then run this migration again.");
  } else {
    console.error("Migration failed:", e);
  }
  process.exit(1);
});
