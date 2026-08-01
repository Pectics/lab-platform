import { describe, expect, it } from "vitest";
import { BearerTokenService } from "./token";

const pepper = "p".repeat(32);
const deterministicRandom = (size: number) => new Uint8Array(size).fill(7);

describe("BearerTokenService", () => {
  it("issues recognizable one-time subscription and Agent secrets", () => {
    const service = new BearerTokenService(pepper, deterministicRandom);

    for (const kind of ["subscription", "agent"] as const) {
      const issued = service.issue(kind);
      const expectedPrefix = kind === "subscription" ? "sub_live_" : "agt_live_";

      expect(issued.secret).toMatch(new RegExp(`^${expectedPrefix}[A-Za-z0-9_-]{43}$`));
      expect(issued.prefix).toMatch(new RegExp(`^${expectedPrefix}[A-Za-z0-9_-]{8}$`));
      expect(issued.digest).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify({ digest: issued.digest, prefix: issued.prefix })).not.toContain(
        issued.secret,
      );
      expect(service.verify(kind, issued.secret, issued.digest)).toBe(true);
    }
  });

  it("uses keyed deterministic digests and rejects wrong kind, secret, or digest encoding", () => {
    const service = new BearerTokenService(pepper, deterministicRandom);
    const issued = service.issue("subscription");

    expect(service.digest(issued.secret)).toBe(issued.digest);
    expect(service.verify("agent", issued.secret, issued.digest)).toBe(false);
    expect(service.verify("subscription", `${issued.secret}x`, issued.digest)).toBe(false);
    expect(service.verify("subscription", issued.secret, "not-a-digest")).toBe(false);
    expect(service.verify("subscription", issued.secret, `f${issued.digest}`)).toBe(false);
    expect(service.verify("subscription", issued.secret, `${issued.digest}f`)).toBe(false);
  });

  it("fails closed on weak pepper and invalid entropy sources", () => {
    expect(() => new BearerTokenService("too-short")).toThrowError(
      "TOKEN_HASH_PEPPER must contain at least 32 bytes",
    );
    expect(() => new BearerTokenService(pepper, () => new Uint8Array(31)).issue("agent")).toThrowError(
      "Token random source must return exactly 32 bytes",
    );
  });
});
