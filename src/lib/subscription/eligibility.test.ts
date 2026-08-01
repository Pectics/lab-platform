import { describe, expect, it } from "vitest";
import { evaluateChainEligibility, evaluateEndpointEligibility } from "./eligibility";

const endpointId = "endpoint-a";
const now = new Date("2026-08-01T00:00:00.000Z");
const active = { enabled: true, archivedAt: null };

function eligibleEndpointInput() {
  return {
    now,
    token: { ...active, expiresAt: null },
    profile: { ...active, endpointIds: new Set([endpointId]) },
    server: active,
    endpoint: {
      ...active,
      id: endpointId,
      protocol: "shadowsocks_2022" as const,
      credentialMode: "per_subscriber" as const,
    },
    rendererProtocols: new Set(["shadowsocks_2022" as const]),
    sharedCredentialAvailable: false,
    managedCredentialState: "active" as const,
  };
}

describe("endpoint eligibility", () => {
  it("accepts only the complete authorized and distributable state", () => {
    expect(evaluateEndpointEligibility(eligibleEndpointInput())).toEqual({
      eligible: true,
      reasons: [],
    });
  });

  it.each([
    ["token disabled", { token: { ...active, enabled: false, expiresAt: null } }, "token_inactive"],
    ["token expired", { token: { ...active, expiresAt: now } }, "token_inactive"],
    ["profile disabled", { profile: { ...active, enabled: false, endpointIds: new Set([endpointId]) } }, "profile_inactive"],
    ["not authorized", { profile: { ...active, endpointIds: new Set<string>() } }, "endpoint_not_authorized"],
    ["server archived", { server: { enabled: true, archivedAt: now } }, "server_inactive"],
    ["endpoint disabled", { endpoint: { ...eligibleEndpointInput().endpoint, enabled: false } }, "endpoint_inactive"],
    ["unsupported protocol", { rendererProtocols: new Set<"shadowsocks_2022" | "hysteria_2">() }, "protocol_unsupported"],
    ["managed pending", { managedCredentialState: "pending" as const }, "managed_credential_not_active"],
  ] as const)("rejects %s", (_name, override, reason) => {
    const result = evaluateEndpointEligibility({ ...eligibleEndpointInput(), ...override });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContainEqual(expect.objectContaining({ code: reason }));
  });

  it("requires shared credentials but does not require a managed credential for shared mode", () => {
    const input = eligibleEndpointInput();
    const unavailable = evaluateEndpointEligibility({
      ...input,
      endpoint: { ...input.endpoint, credentialMode: "shared" },
      managedCredentialState: null,
    });
    expect(unavailable.reasons).toEqual([{ code: "shared_credential_unavailable" }]);

    expect(
      evaluateEndpointEligibility({
        ...input,
        endpoint: { ...input.endpoint, credentialMode: "shared" },
        sharedCredentialAvailable: true,
        managedCredentialState: null,
      }),
    ).toEqual({ eligible: true, reasons: [] });
  });

  it("returns every applicable reason instead of hiding failures behind priority", () => {
    const input = eligibleEndpointInput();
    const result = evaluateEndpointEligibility({
      ...input,
      token: { enabled: false, archivedAt: now, expiresAt: now },
      profile: { enabled: false, archivedAt: now, endpointIds: new Set() },
      server: { enabled: false, archivedAt: now },
      endpoint: { ...input.endpoint, enabled: false, archivedAt: now },
      rendererProtocols: new Set(),
      managedCredentialState: "revoked",
    });

    expect(result.reasons.map(({ code }) => code)).toEqual([
      "token_inactive",
      "profile_inactive",
      "endpoint_not_authorized",
      "server_inactive",
      "endpoint_inactive",
      "protocol_unsupported",
      "managed_credential_not_active",
    ]);
  });
});

describe("chain eligibility", () => {
  const eligibleResult = { eligible: true, reasons: [] };
  const chainInput = () => ({
    multihop: true,
    target: "mihomo" as const,
    rendererSupportsChains: true,
    chain: {
      ...active,
      id: "chain-a",
      hops: [
        { serverId: "server-a", server: active, endpointResults: [eligibleResult] },
        { serverId: "server-b", server: active, endpointResults: [eligibleResult] },
      ],
    },
  });

  it("accepts a complete ordered chain", () => {
    expect(evaluateChainEligibility(chainInput())).toEqual({ eligible: true, reasons: [] });
  });

  it("rejects opt-out, archived, unsupported, and incomplete chains without degrading", () => {
    const input = chainInput();
    const result = evaluateChainEligibility({
      ...input,
      multihop: false,
      target: "v2rayn",
      rendererSupportsChains: false,
      chain: {
        ...input.chain,
        enabled: false,
        hops: [
          input.chain.hops[0],
          {
            serverId: "server-b",
            server: { enabled: false, archivedAt: null },
            endpointResults: [{ eligible: false, reasons: [{ code: "endpoint_inactive" }] }],
          },
        ],
      },
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual([
      { code: "multihop_not_requested" },
      { code: "chain_inactive", resourceId: "chain-a" },
      { code: "chain_renderer_unsupported" },
      { code: "chain_hop_unavailable", resourceId: "server-b" },
    ]);
  });

  it("does not skip a hop that has no eligible endpoint", () => {
    const input = chainInput();
    input.chain.hops[0].endpointResults = [];
    expect(evaluateChainEligibility(input).reasons).toEqual([
      { code: "chain_hop_unavailable", resourceId: "server-a" },
    ]);
  });

  it("independently rejects renderer incapability and v2rayN", () => {
    expect(
      evaluateChainEligibility({ ...chainInput(), rendererSupportsChains: false }).reasons,
    ).toContainEqual({ code: "chain_renderer_unsupported" });
    expect(
      evaluateChainEligibility({ ...chainInput(), target: "v2rayn" }).reasons,
    ).toContainEqual({ code: "chain_renderer_unsupported" });
  });
});
