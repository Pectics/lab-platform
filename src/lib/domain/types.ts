export interface LifecycleState {
  enabled: boolean;
  archivedAt: Date | null;
}

export interface ExpiringLifecycleState extends LifecycleState {
  expiresAt: Date | null;
}

export type CredentialState = "pending" | "active" | "failed" | "revoking" | "revoked";

export type DomainResourceType =
  | "server"
  | "endpoint"
  | "profile"
  | "subscription_token"
  | "chain"
  | "agent";
