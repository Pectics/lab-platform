import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { redactSensitive } from "./redaction";

describe("redactSensitive", () => {
  it("recursively removes sensitive keys, bearer headers, opaque tokens, URLs, and configs", () => {
    const input = {
      authorization: "Bearer sub_live_deadbeef",
      nested: [
        "request failed for Bearer agt_test_abcdef",
        { endpointUrl: "https://user:password@example.test/s/sub_live_secret" },
      ],
      generatedConfig: "complete-config",
      safe: 42,
      nullable: null,
    };

    const redacted = redactSensitive(input);
    const serialized = JSON.stringify(redacted);

    expect(redacted).toEqual({
      authorization: "[REDACTED]",
      nested: ["request failed for Bearer [REDACTED]", { endpointUrl: "[REDACTED]" }],
      generatedConfig: "[REDACTED]",
      safe: 42,
      nullable: null,
    });
    expect(serialized).not.toContain("deadbeef");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("complete-config");
    expect(redactSensitive("Bearer   spaced-token, next")).toBe(
      "Bearer [REDACTED], next",
    );
    expect(redactSensitive("Bearernot-a-header")).toBe("Bearernot-a-header");
  });

  it("never retains generated opaque token bodies in arbitrary messages", () => {
    fc.assert(
      fc.property(fc.base64String({ minLength: 8 }), (body) => {
        const token = `sub_live_${body.replace(/[^A-Za-z0-9_-]/g, "a")}`;
        expect(redactSensitive(`failure for ${token}`)).toBe("failure for [REDACTED]");
      }),
    );
  });
});
