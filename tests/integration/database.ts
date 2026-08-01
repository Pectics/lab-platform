import { sql } from "drizzle-orm";
import { createDatabaseConnection } from "@/infrastructure/database/client";

export function requireTestDatabaseUrl(value = process.env.DATABASE_URL): string {
  if (!value) {
    throw new Error("DATABASE_URL is required for integration tests");
  }

  const parsed = new URL(value);
  const databaseName = parsed.pathname.slice(1);

  if (parsed.protocol !== "postgresql:" || !databaseName.endsWith("_test")) {
    throw new Error("Integration tests require a PostgreSQL database whose name ends in _test");
  }

  return value;
}

export function createTestDatabase() {
  return createDatabaseConnection(requireTestDatabaseUrl());
}

export async function truncateApplicationTables(
  db: ReturnType<typeof createTestDatabase>["db"],
): Promise<void> {
  await db.execute(sql`
    truncate table
      audit_events,
      endpoint_credentials,
      token_server_access_identities,
      agents,
      chain_hops,
      chains,
      subscription_tokens,
      profile_endpoints,
      profiles,
      endpoint_shared_secrets,
      endpoints,
      servers,
      administrators,
      auth_sessions,
      auth_accounts,
      auth_verification_tokens,
      auth_users
    restart identity cascade
  `);
}
