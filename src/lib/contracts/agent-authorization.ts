export type AgentCapability = "reconcile" | "probe";

export interface AgentIdentity {
  serverId: string;
  enabled: boolean;
  archivedAt: Date | null;
  capabilities: ReadonlySet<AgentCapability>;
}

export function canAgentAccess(
  agent: AgentIdentity,
  request: { serverId: string; capability: AgentCapability },
): boolean {
  return (
    agent.enabled &&
    agent.archivedAt === null &&
    agent.serverId === request.serverId &&
    agent.capabilities.has(request.capability)
  );
}
