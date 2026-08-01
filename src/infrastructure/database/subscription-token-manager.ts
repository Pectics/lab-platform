import { eq, sql } from "drizzle-orm";
import { isSubscriptionTokenActive } from "@/lib/domain/lifecycle";
import { BearerTokenService, type IssuedBearerToken } from "@/lib/security/token";
import type { Database } from "./client";
import { auditEvents, subscriptionTokens } from "./schema";

export interface CreatedSubscriptionToken extends IssuedBearerToken {
  id: string;
}

export class PostgresSubscriptionTokenManager {
  constructor(
    private readonly db: Database,
    private readonly tokens: BearerTokenService,
  ) {}

  async create(input: {
    profileId: string;
    remark?: string;
    expiresAt?: Date;
  }): Promise<CreatedSubscriptionToken> {
    const issued = this.tokens.issue("subscription");

    return this.db.transaction(async (transaction) => {
      const [record] = await transaction
        .insert(subscriptionTokens)
        .values({
          profileId: input.profileId,
          remark: input.remark,
          expiresAt: input.expiresAt,
          secretDigest: issued.digest,
          secretPrefix: issued.prefix,
        })
        .returning({ id: subscriptionTokens.id });
      await transaction.insert(auditEvents).values({
        actorType: "administrator",
        action: "subscription_token.created",
        resourceType: "subscription_token",
        resourceId: record.id,
        metadata: { prefix: issued.prefix },
      });
      return { id: record.id, ...issued };
    });
  }

  async rotate(id: string, rotatedAt: Date): Promise<CreatedSubscriptionToken | null> {
    const issued = this.tokens.issue("subscription");

    return this.db.transaction(async (transaction) => {
      const [record] = await transaction
        .update(subscriptionTokens)
        .set({
          secretDigest: issued.digest,
          secretPrefix: issued.prefix,
          rotatedAt,
          updatedAt: rotatedAt,
          generation: sql`${subscriptionTokens.generation} + 1`,
        })
        .where(eq(subscriptionTokens.id, id))
        .returning({ id: subscriptionTokens.id });

      if (!record) {
        return null;
      }

      await transaction.insert(auditEvents).values({
        actorType: "administrator",
        action: "subscription_token.rotated",
        resourceType: "subscription_token",
        resourceId: id,
        metadata: { prefix: issued.prefix },
      });
      return { id, ...issued };
    });
  }

  async authenticate(secret: string, now: Date): Promise<string | null> {
    const digest = this.tokens.digest(secret);
    const [record] = await this.db
      .select({
        id: subscriptionTokens.id,
        secretDigest: subscriptionTokens.secretDigest,
        enabled: subscriptionTokens.enabled,
        archivedAt: subscriptionTokens.archivedAt,
        expiresAt: subscriptionTokens.expiresAt,
      })
      .from(subscriptionTokens)
      .where(eq(subscriptionTokens.secretDigest, digest))
      .limit(1);

    return record &&
      isSubscriptionTokenActive(record, now) &&
      this.tokens.verify("subscription", secret, record.secretDigest)
      ? record.id
      : null;
  }
}
