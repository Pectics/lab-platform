import { and, asc, eq, isNull } from "drizzle-orm";
import { DomainInvariantError } from "@/lib/domain/errors";
import { assertCanCreateAssociation } from "@/lib/domain/lifecycle";
import type {
  ControlPlaneRepository,
  CreateEndpointInput,
  CreateProfileInput,
  CreateServerInput,
} from "@/lib/ports/control-plane-repository";
import type { Database } from "./client";
import {
  endpoints,
  profileEndpoints,
  profiles,
  servers,
  type EndpointRecord,
  type ProfileRecord,
  type ServerRecord,
} from "./schema";

export class PostgresControlPlaneRepository implements ControlPlaneRepository {
  constructor(private readonly db: Database) {}

  async createServer(input: CreateServerInput): Promise<ServerRecord> {
    const [server] = await this.db.insert(servers).values(input).returning();
    return server;
  }

  async createEndpoint(input: CreateEndpointInput): Promise<EndpointRecord> {
    return this.db.transaction(async (transaction) => {
      const [server] = await transaction
        .select({ enabled: servers.enabled, archivedAt: servers.archivedAt })
        .from(servers)
        .where(eq(servers.id, input.serverId))
        .limit(1);

      if (!server) {
        throw new DomainInvariantError("server_not_found", "Endpoint server does not exist");
      }

      assertCanCreateAssociation([{ kind: "server", state: server }]);

      const [endpoint] = await transaction.insert(endpoints).values(input).returning();
      return endpoint;
    });
  }

  async createProfile(input: CreateProfileInput): Promise<ProfileRecord> {
    const [profile] = await this.db.insert(profiles).values(input).returning();
    return profile;
  }

  async attachEndpointToProfile(profileId: string, endpointId: string): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const [profile] = await transaction
        .select({ enabled: profiles.enabled, archivedAt: profiles.archivedAt })
        .from(profiles)
        .where(eq(profiles.id, profileId))
        .limit(1);
      const [endpoint] = await transaction
        .select({ enabled: endpoints.enabled, archivedAt: endpoints.archivedAt })
        .from(endpoints)
        .where(eq(endpoints.id, endpointId))
        .limit(1);

      if (!profile || !endpoint) {
        throw new DomainInvariantError(
          "association_target_not_found",
          "Profile or endpoint does not exist",
        );
      }

      assertCanCreateAssociation([
        { kind: "profile", state: profile },
        { kind: "endpoint", state: endpoint },
      ]);

      await transaction
        .insert(profileEndpoints)
        .values({ profileId, endpointId })
        .onConflictDoNothing();
    });
  }

  async archiveServer(serverId: string, archivedAt: Date): Promise<ServerRecord | null> {
    const [server] = await this.db
      .update(servers)
      .set({ enabled: false, archivedAt, updatedAt: archivedAt })
      .where(and(eq(servers.id, serverId), isNull(servers.archivedAt)))
      .returning();
    return server ?? null;
  }

  async listServers(options: { includeArchived?: boolean } = {}): Promise<ServerRecord[]> {
    const query = this.db.select().from(servers);

    return options.includeArchived
      ? query.orderBy(asc(servers.name))
      : query.where(isNull(servers.archivedAt)).orderBy(asc(servers.name));
  }
}
