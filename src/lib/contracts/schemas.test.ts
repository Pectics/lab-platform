import { describe, expect, it } from "vitest";
import {
  agentApplyResultSchema,
  agentDesiredStateSchema,
  agentHeartbeatSchema,
  agentProbeTaskSchema,
} from "./agent";
import { canonicalSubscriptionProjectionSchema } from "./projection";

const ids = {
  token: "00000000-0000-4000-8000-000000000001",
  server: "00000000-0000-4000-8000-000000000002",
  endpoint: "00000000-0000-4000-8000-000000000003",
  credential: "00000000-0000-4000-8000-000000000004",
  chain: "00000000-0000-4000-8000-000000000005",
  task: "00000000-0000-4000-8000-000000000006",
};

describe("canonical subscription projection", () => {
  it("accepts a fully filtered protocol-neutral renderer input", () => {
    const endpoint = {
      id: ids.endpoint,
      serverId: ids.server,
      name: "Tokyo SS",
      address: "tokyo.example.test",
      port: 443,
      protocol: "shadowsocks_2022",
      credential: { method: "2022-blake3-aes-128-gcm", password: "test-only" },
    } as const;
    const parsed = canonicalSubscriptionProjectionSchema.parse({
      subjectId: ids.token,
      target: "mihomo",
      endpoints: [endpoint],
      chains: [{ id: ids.chain, name: "Tokyo to Seattle", hops: [endpoint, endpoint] }],
      generatedAt: "2026-08-01T00:00:00.000Z",
    });

    expect(parsed.endpoints[0].protocol).toBe("shadowsocks_2022");
  });

  it("rejects malformed ports, one-hop chains, and protocol credential mismatches", () => {
    const base = {
      subjectId: ids.token,
      target: "mihomo",
      endpoints: [],
      chains: [],
      generatedAt: "2026-08-01T00:00:00.000Z",
    };
    expect(
      canonicalSubscriptionProjectionSchema.safeParse({
        ...base,
        endpoints: [
          {
            id: ids.endpoint,
            serverId: ids.server,
            name: "bad",
            address: "host",
            port: 0,
            protocol: "shadowsocks_2022",
            credential: { auth: "wrong-shape" },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      canonicalSubscriptionProjectionSchema.safeParse({
        ...base,
        chains: [{ id: ids.chain, name: "one hop", hops: [{}] }],
      }).success,
    ).toBe(false);
  });
});

describe("Agent contracts", () => {
  it("accepts full desired state, heartbeat, apply result, and bounded probe tasks", () => {
    expect(
      agentDesiredStateSchema.parse({
        serverId: ids.server,
        generation: 7,
        etag: '"generation-7"',
        credentials: [
          {
            id: ids.credential,
            endpointId: ids.endpoint,
            protocol: "hysteria_2",
            desired: "present",
            secret: "test-only",
          },
          {
            id: ids.token,
            endpointId: ids.endpoint,
            protocol: "hysteria_2",
            desired: "absent",
          },
        ],
      }).generation,
    ).toBe(7);
    expect(
      agentHeartbeatSchema.parse({
        serverId: ids.server,
        appliedGeneration: 7,
        capabilities: ["reconcile", "probe"],
        healthy: true,
        observedAt: "2026-08-01T00:00:00.000Z",
      }).capabilities,
    ).toEqual(["reconcile", "probe"]);
    expect(
      agentApplyResultSchema.parse({
        serverId: ids.server,
        generation: 7,
        status: "partial",
        outcomes: [
          { credentialId: ids.credential, state: "active" },
          { credentialId: ids.token, state: "failed", errorCode: "agent_apply_failed" },
        ],
      }).status,
    ).toBe("partial");
    expect(
      agentProbeTaskSchema.parse({
        id: ids.task,
        endpointId: ids.endpoint,
        address: "tokyo.example.test",
        port: 443,
        deadline: "2026-08-01T00:01:00.000Z",
      }).port,
    ).toBe(443);
  });

  it("rejects negative generations, duplicate capabilities, absent secrets, and unscoped failures", () => {
    expect(
      agentDesiredStateSchema.safeParse({
        serverId: ids.server,
        generation: -1,
        etag: "etag",
        credentials: [],
      }).success,
    ).toBe(false);
    expect(
      agentHeartbeatSchema.safeParse({
        serverId: ids.server,
        appliedGeneration: 0,
        capabilities: ["probe", "probe"],
        healthy: true,
        observedAt: "2026-08-01T00:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      agentDesiredStateSchema.safeParse({
        serverId: ids.server,
        generation: 1,
        etag: "etag",
        credentials: [
          {
            id: ids.credential,
            endpointId: ids.endpoint,
            protocol: "hysteria_2",
            desired: "present",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      agentApplyResultSchema.safeParse({
        serverId: ids.server,
        generation: 1,
        status: "failed",
        outcomes: [{ credentialId: ids.credential, state: "failed" }],
      }).success,
    ).toBe(false);
    expect(
      agentProbeTaskSchema.safeParse({
        id: ids.task,
        endpointId: ids.endpoint,
        address: "host",
        port: 65536,
        deadline: "not-a-date",
      }).success,
    ).toBe(false);
  });
});
