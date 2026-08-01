import type { CanonicalSubscriptionProjection } from "@/lib/contracts/projection";
import type { z } from "zod";
import type { agentDesiredStateSchema } from "@/lib/contracts/agent";

export interface SubscriptionRenderer {
  render(projection: CanonicalSubscriptionProjection): Promise<string>;
}

export interface AgentDesiredStateProvider {
  getDesiredState(serverId: string): Promise<z.infer<typeof agentDesiredStateSchema>>;
}

export interface AuditWriter {
  write(event: {
    actorType: "administrator" | "agent" | "system";
    actorId?: string;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
}

export interface StructuredLogger {
  info(message: string, metadata: Record<string, unknown>): void;
  error(message: string, metadata: Record<string, unknown>): void;
}
