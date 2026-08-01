import { DomainInvariantError } from "./errors";
import type { CredentialState } from "./types";

const transitions: Readonly<Record<CredentialState, ReadonlySet<CredentialState>>> = {
  pending: new Set(["active", "failed", "revoking"]),
  active: new Set(["revoking"]),
  failed: new Set(["pending", "revoking"]),
  revoking: new Set(["failed", "revoked"]),
  revoked: new Set(),
};

export function canTransitionCredential(from: CredentialState, to: CredentialState): boolean {
  return from === to || transitions[from].has(to);
}

export function transitionCredential(from: CredentialState, to: CredentialState): CredentialState {
  if (!canTransitionCredential(from, to)) {
    throw new DomainInvariantError(
      "invalid_credential_transition",
      `Credential cannot transition from ${from} to ${to}`,
    );
  }

  return to;
}
