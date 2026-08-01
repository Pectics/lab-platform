import { createDatabaseConnection } from "./client";

const globalDatabase = globalThis as typeof globalThis & {
  labPlatformDatabase?: ReturnType<typeof createDatabaseConnection>;
};

export const databaseConnection =
  globalDatabase.labPlatformDatabase ?? createDatabaseConnection(process.env.DATABASE_URL);

if (process.env.NODE_ENV !== "production") {
  globalDatabase.labPlatformDatabase = databaseConnection;
}
