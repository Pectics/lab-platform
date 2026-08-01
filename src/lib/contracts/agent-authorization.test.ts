import { describe, expect, it } from "vitest";
import { canAgentAccess } from "./agent-authorization";

describe("Agent authorization scope", () => {
  const agent = {
    serverId: "server-a",
    enabled: true,
    archivedAt: null,
    capabilities: new Set(["reconcile" as const]),
  };

  it("allows only its own Server and declared capability", () => {
    expect(canAgentAccess(agent, { serverId: "server-a", capability: "reconcile" })).toBe(true);
    expect(canAgentAccess(agent, { serverId: "server-b", capability: "reconcile" })).toBe(false);
    expect(canAgentAccess(agent, { serverId: "server-a", capability: "probe" })).toBe(false);
  });

  it("rejects disabled and archived identities", () => {
    expect(canAgentAccess({ ...agent, enabled: false }, { serverId: "server-a", capability: "reconcile" })).toBe(false);
    expect(
      canAgentAccess(
        { ...agent, archivedAt: new Date(0) },
        { serverId: "server-a", capability: "reconcile" },
      ),
    ).toBe(false);
  });
});
