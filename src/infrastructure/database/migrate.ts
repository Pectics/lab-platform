import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabaseConnection } from "./client";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../drizzle",
);

export async function migrateDatabase(databaseUrl = process.env.DATABASE_URL): Promise<void> {
  const { db, pool } = createDatabaseConnection(databaseUrl);

  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}
