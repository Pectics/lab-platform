import { describe, expect, it } from "vitest";
import { canTransitionCredential, transitionCredential } from "./credential-state";
import { DomainInvariantError } from "./errors";
import type { CredentialState } from "./types";

const states: CredentialState[] = ["pending", "active", "failed", "revoking", "revoked"];
const allowed = new Set([
  "pending:pending",
  "pending:active",
  "pending:failed",
  "pending:revoking",
  "active:active",
  "active:revoking",
  "failed:pending",
  "failed:failed",
  "failed:revoking",
  "revoking:failed",
  "revoking:revoking",
  "revoking:revoked",
  "revoked:revoked",
]);

describe("credential state machine", () => {
  it("exhaustively enforces the transition matrix", () => {
    for (const from of states) {
      for (const to of states) {
        const expected = allowed.has(`${from}:${to}`);
        expect(canTransitionCredential(from, to), `${from} -> ${to}`).toBe(expected);

        if (expected) {
          expect(transitionCredential(from, to)).toBe(to);
        } else {
          expect(() => transitionCredential(from, to)).toThrowError(
            new DomainInvariantError(
              "invalid_credential_transition",
              `Credential cannot transition from ${from} to ${to}`,
            ),
          );
        }
      }
    }
  });
});
