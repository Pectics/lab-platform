import { isActive, isSubscriptionTokenActive } from "@/lib/domain/lifecycle";
import type { ExpiringLifecycleState, LifecycleState } from "@/lib/domain/types";
import type { SubscriptionTarget } from "@/lib/contracts/subscription-request";

export type EligibilityReasonCode =
  | "token_inactive"
  | "profile_inactive"
  | "endpoint_not_authorized"
  | "server_inactive"
  | "endpoint_inactive"
  | "protocol_unsupported"
  | "shared_credential_unavailable"
  | "managed_credential_not_active"
  | "multihop_not_requested"
  | "chain_inactive"
  | "chain_renderer_unsupported"
  | "chain_hop_unavailable";

export interface EligibilityReason {
  code: EligibilityReasonCode;
  resourceId?: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: EligibilityReason[];
}

export function evaluateEndpointEligibility(input: {
  now: Date;
  token: ExpiringLifecycleState;
  profile: LifecycleState & { endpointIds: ReadonlySet<string> };
  server: LifecycleState;
  endpoint: LifecycleState & {
    id: string;
    protocol: "shadowsocks_2022" | "hysteria_2";
    credentialMode: "shared" | "per_subscriber";
  };
  rendererProtocols: ReadonlySet<"shadowsocks_2022" | "hysteria_2">;
  sharedCredentialAvailable: boolean;
  managedCredentialState: "pending" | "active" | "failed" | "revoking" | "revoked" | null;
}): EligibilityResult {
  const reasons: EligibilityReason[] = [];

  if (!isSubscriptionTokenActive(input.token, input.now)) reasons.push({ code: "token_inactive" });
  if (!isActive(input.profile)) reasons.push({ code: "profile_inactive" });
  if (!input.profile.endpointIds.has(input.endpoint.id)) {
    reasons.push({ code: "endpoint_not_authorized", resourceId: input.endpoint.id });
  }
  if (!isActive(input.server)) reasons.push({ code: "server_inactive" });
  if (!isActive(input.endpoint)) reasons.push({ code: "endpoint_inactive" });
  if (!input.rendererProtocols.has(input.endpoint.protocol)) {
    reasons.push({ code: "protocol_unsupported" });
  }
  if (input.endpoint.credentialMode === "shared" && !input.sharedCredentialAvailable) {
    reasons.push({ code: "shared_credential_unavailable" });
  }
  if (
    input.endpoint.credentialMode === "per_subscriber" &&
    input.managedCredentialState !== "active"
  ) {
    reasons.push({ code: "managed_credential_not_active" });
  }

  return { eligible: reasons.length === 0, reasons };
}

export function evaluateChainEligibility(input: {
  multihop: boolean;
  target: SubscriptionTarget;
  rendererSupportsChains: boolean;
  chain: LifecycleState & {
    id: string;
    hops: ReadonlyArray<{
      serverId: string;
      server: LifecycleState;
      endpointResults: ReadonlyArray<EligibilityResult>;
    }>;
  };
}): EligibilityResult {
  const reasons: EligibilityReason[] = [];

  if (!input.multihop) reasons.push({ code: "multihop_not_requested" });
  if (!isActive(input.chain)) reasons.push({ code: "chain_inactive", resourceId: input.chain.id });
  if (!input.rendererSupportsChains || input.target === "v2rayn") {
    reasons.push({ code: "chain_renderer_unsupported" });
  }

  for (const hop of input.chain.hops) {
    const hasEligibleEndpoint = isActive(hop.server) && hop.endpointResults.some(({ eligible }) => eligible);
    if (!hasEligibleEndpoint) {
      reasons.push({ code: "chain_hop_unavailable", resourceId: hop.serverId });
    }
  }

  return { eligible: reasons.length === 0, reasons };
}
