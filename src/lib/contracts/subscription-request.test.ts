import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ContractError } from "./errors";
import { parseCredential, parseSubscriptionRequest, parseTarget } from "./subscription-request";

describe("subscription request contract", () => {
  it("gives any supplied Authorization header strict priority over path credentials", () => {
    expect(
      parseCredential(new Headers({ authorization: "Bearer sub_live_header" }), "sub_live_path"),
    ).toEqual({ token: "sub_live_header", tokenSource: "authorization" });

    for (const authorization of [
      "",
      "Basic abc",
      "Bearer",
      "Bearer  two",
      "Bearer one two",
      "prefix Bearer token",
    ]) {
      expect(() =>
        parseCredential(new Headers({ authorization }), "sub_live_valid_path"),
      ).toThrowError(
        new ContractError(
          "authorization_header_invalid",
          "Authorization must contain exactly one Bearer credential",
        ),
      );
    }
  });

  it("uses the path only when Authorization is absent and rejects missing credentials", () => {
    expect(parseCredential(new Headers(), "sub_live_path")).toEqual({
      token: "sub_live_path",
      tokenSource: "path",
    });
    expect(() => parseCredential(new Headers())).toThrowError(
      new ContractError("subscription_token_missing", "Subscription credential is required"),
    );
    try {
      parseCredential(new Headers());
      expect.fail("Expected missing credential error");
    } catch (error) {
      expect(error).toMatchObject({ name: "ContractError" });
    }
  });

  it.each([
    ["mihomo", "sing-box/1.0", "mihomo"],
    ["sing-box", "v2rayN", "sing-box"],
    ["v2rayn", "Mihomo", "v2rayn"],
    [null, "sing-box/1.12", "sing-box"],
    [null, "v2rayN/7.0", "v2rayn"],
    [null, "Clash.Meta", "mihomo"],
    [null, null, "mihomo"],
  ] as const)("resolves explicit target before User-Agent", (explicit, ua, expected) => {
    expect(parseTarget(explicit, ua)).toBe(expected);
  });

  it("rejects every unknown explicit target without User-Agent fallback", () => {
    for (const target of ["", "clash", "Sing-Box", "unknown"]) {
      expect(() => parseTarget(target, "sing-box/1.0")).toThrowError(
        new ContractError("target_unknown", "Unknown explicit subscription target"),
      );
    }
  });

  it("enables multihop only for the exact value 1 and rejects v2rayN multihop", () => {
    fc.assert(
      fc.property(fc.string().filter((value) => value !== "1"), (value) => {
        const parsed = parseSubscriptionRequest({
          headers: new Headers(),
          pathToken: "sub_live_path",
          searchParams: new URLSearchParams({ multihop: value }),
        });
        expect(parsed.multihop).toBe(false);
      }),
    );

    expect(
      parseSubscriptionRequest({
        headers: new Headers(),
        pathToken: "sub_live_path",
        searchParams: new URLSearchParams({ multihop: "1", target: "mihomo" }),
      }).multihop,
    ).toBe(true);
    expect(() =>
      parseSubscriptionRequest({
        headers: new Headers(),
        pathToken: "sub_live_path",
        searchParams: new URLSearchParams({ multihop: "1", target: "v2rayn" }),
      }),
    ).toThrowError(
      new ContractError("multihop_unsupported", "v2rayN cannot represent multihop chains"),
    );
  });

  it("does not recognize legacy query credentials", () => {
    expect(() =>
      parseSubscriptionRequest({
        headers: new Headers(),
        searchParams: new URLSearchParams({ token: "legacy", auth: "legacy" }),
      }),
    ).toThrowError(
      new ContractError("subscription_token_missing", "Subscription credential is required"),
    );
  });
});
