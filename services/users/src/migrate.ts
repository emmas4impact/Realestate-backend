import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env (npm runs this script from the service directory)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function run() {
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const { db } = await import("./db/index.js");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Users migrations applied.");
  process.exit(0);
}
run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
