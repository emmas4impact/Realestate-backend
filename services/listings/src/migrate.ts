import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env (npm runs this script from the service directory)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function run() {
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const { db } = await import("./db/index.js");
  const migrationsFolder = path.join(__dirname, "..", "drizzle");
  await migrate(db, { migrationsFolder, migrationsTable: "__drizzle_migrations_listings" });
  console.log("Listings migrations applied.");
  process.exit(0);
}
run().catch((e: NodeJS.ErrnoException) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
