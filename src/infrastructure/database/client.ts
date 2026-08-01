import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./schema";

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseConnection {
  db: Database;
  pool: Pool;
}

export function createDatabaseConnection(databaseUrl = process.env.DATABASE_URL): DatabaseConnection {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: process.env.NODE_ENV === "test" ? 4 : 10,
  });

  return {
    db: drizzle(pool, { schema }),
    pool,
  };
}
