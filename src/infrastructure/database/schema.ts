import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
    .defaultNow()
    .notNull(),
};

const lifecycle = {
  enabled: boolean("enabled").default(true).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true, precision: 3 }),
};

const generation = bigint("generation", { mode: "number" }).default(0).notNull();

export const endpointProtocol = pgEnum("endpoint_protocol", [
  "shadowsocks_2022",
  "hysteria_2",
]);
export const credentialMode = pgEnum("credential_mode", ["shared", "per_subscriber"]);
export const credentialState = pgEnum("credential_state", [
  "pending",
  "active",
  "failed",
  "revoking",
  "revoked",
]);
export const auditActorType = pgEnum("audit_actor_type", ["administrator", "agent", "system"]);

export const administrators = pgTable(
  "administrators",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    githubUserId: bigint("github_user_id", { mode: "number" }).notNull(),
    githubLogin: varchar("github_login", { length: 255 }),
    displayName: varchar("display_name", { length: 255 }),
    avatarUrl: text("avatar_url"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true, precision: 3 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("administrators_github_user_id_uq").on(table.githubUserId),
    check("administrators_github_user_id_positive", sql`${table.githubUserId} > 0`),
  ],
);

export const servers = pgTable(
  "servers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    provider: varchar("provider", { length: 120 }),
    region: varchar("region", { length: 120 }),
    host: varchar("host", { length: 255 }).notNull(),
    notes: text("notes"),
    ...lifecycle,
    generation,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("servers_name_uq").on(table.name),
    check("servers_name_not_blank", sql`length(trim(${table.name})) > 0`),
    check("servers_host_not_blank", sql`length(trim(${table.host})) > 0`),
    check("servers_generation_nonnegative", sql`${table.generation} >= 0`),
    index("servers_active_idx").on(table.archivedAt, table.enabled),
  ],
);

export const endpoints = pgTable(
  "endpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    protocol: endpointProtocol("protocol").notNull(),
    credentialMode: credentialMode("credential_mode").notNull(),
    address: varchar("address", { length: 255 }).notNull(),
    port: integer("port").notNull(),
    publicConfig: jsonb("public_config").$type<Record<string, unknown>>().default({}).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...lifecycle,
    generation,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("endpoints_server_name_uq").on(table.serverId, table.name),
    unique("endpoints_id_server_uq").on(table.id, table.serverId),
    check("endpoints_name_not_blank", sql`length(trim(${table.name})) > 0`),
    check("endpoints_address_not_blank", sql`length(trim(${table.address})) > 0`),
    check("endpoints_port_valid", sql`${table.port} between 1 and 65535`),
    check("endpoints_sort_order_nonnegative", sql`${table.sortOrder} >= 0`),
    check("endpoints_generation_nonnegative", sql`${table.generation} >= 0`),
    index("endpoints_publication_idx").on(
      table.serverId,
      table.archivedAt,
      table.enabled,
      table.sortOrder,
    ),
  ],
);

export const endpointSharedSecrets = pgTable(
  "endpoint_shared_secrets",
  {
    endpointId: uuid("endpoint_id")
      .primaryKey()
      .references(() => endpoints.id, { onDelete: "restrict", onUpdate: "cascade" }),
    ciphertext: text("ciphertext").notNull(),
    nonce: text("nonce").notNull(),
    keyVersion: integer("key_version").notNull(),
    ...timestamps,
  },
  (table) => [
    check("endpoint_shared_secrets_ciphertext_not_blank", sql`length(${table.ciphertext}) > 0`),
    check("endpoint_shared_secrets_nonce_not_blank", sql`length(${table.nonce}) > 0`),
    check("endpoint_shared_secrets_key_version_positive", sql`${table.keyVersion} > 0`),
  ],
);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    ...lifecycle,
    generation,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("profiles_name_uq").on(table.name),
    check("profiles_name_not_blank", sql`length(trim(${table.name})) > 0`),
    check("profiles_generation_nonnegative", sql`${table.generation} >= 0`),
    index("profiles_active_idx").on(table.archivedAt, table.enabled),
  ],
);

export const profileEndpoints = pgTable(
  "profile_endpoints",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict", onUpdate: "cascade" }),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => endpoints.id, { onDelete: "restrict", onUpdate: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.profileId, table.endpointId], name: "profile_endpoints_pk" }),
    index("profile_endpoints_endpoint_idx").on(table.endpointId),
  ],
);

export const subscriptionTokens = pgTable(
  "subscription_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict", onUpdate: "cascade" }),
    secretDigest: varchar("secret_digest", { length: 64 }).notNull(),
    secretPrefix: varchar("secret_prefix", { length: 24 }).notNull(),
    remark: text("remark"),
    ...lifecycle,
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }),
    rotatedAt: timestamp("rotated_at", { withTimezone: true, precision: 3 }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, precision: 3 }),
    generation,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("subscription_tokens_digest_uq").on(table.secretDigest),
    index("subscription_tokens_prefix_idx").on(table.secretPrefix),
    index("subscription_tokens_profile_idx").on(table.profileId, table.archivedAt, table.enabled),
    check("subscription_tokens_digest_hex", sql`${table.secretDigest} ~ '^[0-9a-f]{64}$'`),
    check("subscription_tokens_prefix_not_blank", sql`length(trim(${table.secretPrefix})) > 0`),
    check("subscription_tokens_generation_nonnegative", sql`${table.generation} >= 0`),
  ],
);

export const chains = pgTable(
  "chains",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    ...lifecycle,
    generation,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("chains_name_uq").on(table.name),
    check("chains_name_not_blank", sql`length(trim(${table.name})) > 0`),
    check("chains_generation_nonnegative", sql`${table.generation} >= 0`),
    index("chains_active_idx").on(table.archivedAt, table.enabled),
  ],
);

export const chainHops = pgTable(
  "chain_hops",
  {
    chainId: uuid("chain_id")
      .notNull()
      .references(() => chains.id, { onDelete: "restrict", onUpdate: "cascade" }),
    position: integer("position").notNull(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "restrict", onUpdate: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chainId, table.position], name: "chain_hops_pk" }),
    uniqueIndex("chain_hops_chain_server_uq").on(table.chainId, table.serverId),
    check("chain_hops_position_nonnegative", sql`${table.position} >= 0`),
    index("chain_hops_server_idx").on(table.serverId),
  ],
);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    secretDigest: varchar("secret_digest", { length: 64 }).notNull(),
    secretPrefix: varchar("secret_prefix", { length: 24 }).notNull(),
    capabilities: text("capabilities").array().default(sql`ARRAY[]::text[]`).notNull(),
    ...lifecycle,
    desiredGeneration: bigint("desired_generation", { mode: "number" }).default(0).notNull(),
    appliedGeneration: bigint("applied_generation", { mode: "number" }).default(0).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, precision: 3 }),
    lastHealthyAt: timestamp("last_healthy_at", { withTimezone: true, precision: 3 }),
    lastErrorCode: varchar("last_error_code", { length: 120 }),
    rotatedAt: timestamp("rotated_at", { withTimezone: true, precision: 3 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("agents_server_uq").on(table.serverId),
    uniqueIndex("agents_digest_uq").on(table.secretDigest),
    index("agents_prefix_idx").on(table.secretPrefix),
    check("agents_name_not_blank", sql`length(trim(${table.name})) > 0`),
    check("agents_digest_hex", sql`${table.secretDigest} ~ '^[0-9a-f]{64}$'`),
    check("agents_prefix_not_blank", sql`length(trim(${table.secretPrefix})) > 0`),
    check(
      "agents_capabilities_valid",
      sql`${table.capabilities} <@ ARRAY['reconcile', 'probe']::text[]`,
    ),
    check("agents_desired_generation_nonnegative", sql`${table.desiredGeneration} >= 0`),
    check("agents_applied_generation_nonnegative", sql`${table.appliedGeneration} >= 0`),
    check(
      "agents_applied_generation_not_ahead",
      sql`${table.appliedGeneration} <= ${table.desiredGeneration}`,
    ),
  ],
);

export const tokenServerAccessIdentities = pgTable(
  "token_server_access_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subscriptionTokenId: uuid("subscription_token_id")
      .notNull()
      .references(() => subscriptionTokens.id, { onDelete: "restrict", onUpdate: "cascade" }),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "restrict", onUpdate: "cascade" }),
    generation,
    revokedAt: timestamp("revoked_at", { withTimezone: true, precision: 3 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("token_server_access_identity_token_server_uq").on(
      table.subscriptionTokenId,
      table.serverId,
    ),
    unique("token_server_access_identity_id_server_uq").on(table.id, table.serverId),
    check("token_server_access_identity_generation_nonnegative", sql`${table.generation} >= 0`),
  ],
);

export const endpointCredentials = pgTable(
  "endpoint_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    serverId: uuid("server_id").notNull(),
    endpointId: uuid("endpoint_id").notNull(),
    accessIdentityId: uuid("access_identity_id").notNull(),
    revision: integer("revision").notNull(),
    state: credentialState("state").default("pending").notNull(),
    ciphertext: text("ciphertext").notNull(),
    nonce: text("nonce").notNull(),
    keyVersion: integer("key_version").notNull(),
    failureCode: varchar("failure_code", { length: 120 }),
    appliedAt: timestamp("applied_at", { withTimezone: true, precision: 3 }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, precision: 3 }),
    generation,
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.endpointId, table.serverId],
      foreignColumns: [endpoints.id, endpoints.serverId],
      name: "endpoint_credentials_endpoint_server_fk",
    }).onDelete("restrict").onUpdate("cascade"),
    foreignKey({
      columns: [table.accessIdentityId, table.serverId],
      foreignColumns: [tokenServerAccessIdentities.id, tokenServerAccessIdentities.serverId],
      name: "endpoint_credentials_identity_server_fk",
    }).onDelete("restrict").onUpdate("cascade"),
    uniqueIndex("endpoint_credentials_revision_uq").on(
      table.endpointId,
      table.accessIdentityId,
      table.revision,
    ),
    index("endpoint_credentials_publication_idx").on(table.endpointId, table.state),
    index("endpoint_credentials_identity_idx").on(table.accessIdentityId, table.state),
    check("endpoint_credentials_revision_positive", sql`${table.revision} > 0`),
    check("endpoint_credentials_ciphertext_not_blank", sql`length(${table.ciphertext}) > 0`),
    check("endpoint_credentials_nonce_not_blank", sql`length(${table.nonce}) > 0`),
    check("endpoint_credentials_key_version_positive", sql`${table.keyVersion} > 0`),
    check("endpoint_credentials_generation_nonnegative", sql`${table.generation} >= 0`),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    actorType: auditActorType("actor_type").notNull(),
    actorId: varchar("actor_id", { length: 120 }),
    action: varchar("action", { length: 120 }).notNull(),
    resourceType: varchar("resource_type", { length: 120 }).notNull(),
    resourceId: varchar("resource_id", { length: 120 }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("audit_events_action_not_blank", sql`length(trim(${table.action})) > 0`),
    check("audit_events_resource_type_not_blank", sql`length(trim(${table.resourceType})) > 0`),
    check("audit_events_resource_id_not_blank", sql`length(trim(${table.resourceId})) > 0`),
    index("audit_events_resource_idx").on(table.resourceType, table.resourceId, table.createdAt),
    index("audit_events_actor_idx").on(table.actorType, table.actorId, table.createdAt),
  ],
);

export const schema = {
  administrators,
  agents,
  auditEvents,
  chainHops,
  chains,
  endpointCredentials,
  endpointSharedSecrets,
  endpoints,
  profileEndpoints,
  profiles,
  servers,
  subscriptionTokens,
  tokenServerAccessIdentities,
};

export type ServerRecord = typeof servers.$inferSelect;
export type EndpointRecord = typeof endpoints.$inferSelect;
export type ProfileRecord = typeof profiles.$inferSelect;
