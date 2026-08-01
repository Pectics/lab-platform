import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DomainInvariantError } from "@/lib/domain/errors";
import { PostgresControlPlaneRepository } from "@/infrastructure/database/control-plane-repository";
import {
  agents,
  chainHops,
  chains,
  endpointCredentials,
  endpoints,
  profiles,
  servers,
  subscriptionTokens,
  tokenServerAccessIdentities,
} from "@/infrastructure/database/schema";
import {
  createTestDatabase,
  requireTestDatabaseUrl,
  truncateApplicationTables,
} from "./database";

const database = createTestDatabase();
const repository = new PostgresControlPlaneRepository(database.db);
const digest = (character: string) => character.repeat(64);

beforeAll(async () => {
  await database.pool.query("select 1");
});

beforeEach(async () => {
  await truncateApplicationTables(database.db);
});

afterAll(async () => {
  await database.pool.end();
});

describe("PostgreSQL migration baseline", () => {
  it("refuses missing, non-PostgreSQL, and non-test cleanup targets", () => {
    expect(() => requireTestDatabaseUrl("")).toThrowError(
      "DATABASE_URL is required for integration tests",
    );
    expect(() => requireTestDatabaseUrl("https://example.test/lab_platform_test")).toThrowError(
      "Integration tests require a PostgreSQL database whose name ends in _test",
    );
    expect(() =>
      requireTestDatabaseUrl("postgresql://postgres:postgres@example.test/lab_platform"),
    ).toThrowError("Integration tests require a PostgreSQL database whose name ends in _test");
  });

  it("creates every control-plane authority table", async () => {
    const result = await database.db.execute<{ table_name: string }>(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'administrators', 'servers', 'endpoints', 'endpoint_shared_secrets',
          'profiles', 'profile_endpoints', 'subscription_tokens', 'chains',
          'chain_hops', 'agents', 'token_server_access_identities',
          'endpoint_credentials', 'audit_events'
        )
      order by table_name
    `);

    expect(result.rows.map(({ table_name }) => table_name)).toHaveLength(13);
  });

  it("enforces token, endpoint, chain, and one-agent-per-server constraints", async () => {
    const [server] = await database.db
      .insert(servers)
      .values({ name: "Tokyo", host: "tokyo.example.test" })
      .returning();
    const [profile] = await database.db.insert(profiles).values({ name: "Friends" }).returning();

    await database.db.insert(subscriptionTokens).values({
      profileId: profile.id,
      secretDigest: digest("a"),
      secretPrefix: "sub_live_a",
    });
    await expect(
      database.db.insert(subscriptionTokens).values({
        profileId: profile.id,
        secretDigest: digest("a"),
        secretPrefix: "sub_live_duplicate",
      }),
    ).rejects.toThrow();

    await expect(
      database.db.insert(endpoints).values({
        serverId: server.id,
        name: "invalid-port",
        protocol: "hysteria_2",
        credentialMode: "shared",
        address: "tokyo.example.test",
        port: 0,
      }),
    ).rejects.toThrow();

    await database.db.insert(agents).values({
      serverId: server.id,
      name: "tokyo-agent",
      secretDigest: digest("b"),
      secretPrefix: "agt_live_b",
      capabilities: ["reconcile"],
    });
    await expect(
      database.db.insert(agents).values({
        serverId: server.id,
        name: "duplicate-agent",
        secretDigest: digest("c"),
        secretPrefix: "agt_live_c",
      }),
    ).rejects.toThrow();

    const [chain] = await database.db.insert(chains).values({ name: "Tokyo exit" }).returning();
    await expect(
      database.db.insert(chainHops).values({ chainId: chain.id, position: -1, serverId: server.id }),
    ).rejects.toThrow();
  });
});

describe("PostgresControlPlaneRepository", () => {
  it("hides archived servers by default and makes archive idempotent", async () => {
    const tokyo = await repository.createServer({ name: "Tokyo", host: "tokyo.example.test" });
    await repository.createServer({ name: "Osaka", host: "osaka.example.test" });
    const archivedAt = new Date("2026-08-01T00:00:00.000Z");

    expect(await repository.archiveServer(tokyo.id, archivedAt)).toMatchObject({
      id: tokyo.id,
      enabled: false,
      archivedAt,
    });
    expect(await repository.archiveServer(tokyo.id, new Date())).toBeNull();
    expect((await repository.listServers()).map(({ name }) => name)).toEqual(["Osaka"]);
    expect((await repository.listServers({ includeArchived: true })).map(({ name }) => name)).toEqual([
      "Osaka",
      "Tokyo",
    ]);
  });

  it("rejects new relationships to missing, disabled, or archived resources", async () => {
    await expect(
      repository.createEndpoint({
        serverId: "00000000-0000-0000-0000-000000000000",
        name: "missing",
        protocol: "shadowsocks_2022",
        credentialMode: "per_subscriber",
        address: "missing.example.test",
        port: 443,
      }),
    ).rejects.toThrowError(
      new DomainInvariantError("server_not_found", "Endpoint server does not exist"),
    );

    const server = await repository.createServer({ name: "Tokyo", host: "tokyo.example.test" });
    const endpoint = await repository.createEndpoint({
      serverId: server.id,
      name: "hy2",
      protocol: "hysteria_2",
      credentialMode: "per_subscriber",
      address: "tokyo.example.test",
      port: 443,
    });
    const profile = await repository.createProfile({ name: "Friends" });
    await repository.attachEndpointToProfile(profile.id, endpoint.id);
    await repository.attachEndpointToProfile(profile.id, endpoint.id);

    await database.db.update(endpoints).set({ enabled: false }).where(sql`${endpoints.id} = ${endpoint.id}`);
    await expect(repository.attachEndpointToProfile(profile.id, endpoint.id)).rejects.toThrowError(
      new DomainInvariantError(
        "association_target_inactive",
        "Cannot associate inactive or archived endpoint",
      ),
    );
    await expect(
      repository.attachEndpointToProfile("00000000-0000-0000-0000-000000000000", endpoint.id),
    ).rejects.toThrowError(
      new DomainInvariantError(
        "association_target_not_found",
        "Profile or endpoint does not exist",
      ),
    );
  });

  it("prevents a credential from crossing its Token x Server identity boundary", async () => {
    const [serverA, serverB] = await database.db
      .insert(servers)
      .values([
        { name: "Tokyo", host: "tokyo.example.test" },
        { name: "Seattle", host: "seattle.example.test" },
      ])
      .returning();
    const [profile] = await database.db.insert(profiles).values({ name: "Friends" }).returning();
    const [token] = await database.db
      .insert(subscriptionTokens)
      .values({ profileId: profile.id, secretDigest: digest("d"), secretPrefix: "sub_live_d" })
      .returning();
    const [endpointA] = await database.db
      .insert(endpoints)
      .values({
        serverId: serverA.id,
        name: "tokyo-ss",
        protocol: "shadowsocks_2022",
        credentialMode: "per_subscriber",
        address: "tokyo.example.test",
        port: 443,
      })
      .returning();
    const [identityB] = await database.db
      .insert(tokenServerAccessIdentities)
      .values({ subscriptionTokenId: token.id, serverId: serverB.id })
      .returning();

    await expect(
      database.db.insert(endpointCredentials).values({
        serverId: serverA.id,
        endpointId: endpointA.id,
        accessIdentityId: identityB.id,
        revision: 1,
        ciphertext: "test-ciphertext",
        nonce: "test-nonce",
        keyVersion: 1,
      }),
    ).rejects.toThrow();
  });
});
