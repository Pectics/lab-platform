import { describe, expect, it } from "vitest";
import { isConfiguredGithubAdministrator, parseConfiguredGithubUserId } from "./administrator";

describe("GitHub administrator identity", () => {
  it.each([
    [undefined, null],
    ["", null],
    ["name", null],
    ["123suffix", null],
    ["prefix123", null],
    ["0", null],
    ["-1", null],
    ["0186024864", null],
    ["186024864 ", null],
    ["9007199254740992", null],
    ["186024864", 186024864],
  ] as const)("parses only positive safe numeric IDs", (value, expected) => {
    expect(parseConfiguredGithubUserId(value)).toBe(expected);
  });

  it("accepts only exact numeric profile identity", () => {
    expect(isConfiguredGithubAdministrator(186024864, "186024864")).toBe(true);
    expect(isConfiguredGithubAdministrator("186024864", "186024864")).toBe(true);
    expect(isConfiguredGithubAdministrator("Pectics", "186024864")).toBe(false);
    expect(isConfiguredGithubAdministrator(null, "186024864")).toBe(false);
    expect(isConfiguredGithubAdministrator(186024864, undefined)).toBe(false);
    expect(isConfiguredGithubAdministrator("null", undefined)).toBe(false);
    expect(isConfiguredGithubAdministrator(null, undefined)).toBe(false);
    expect(
      isConfiguredGithubAdministrator({ toString: () => "186024864" }, "186024864"),
    ).toBe(false);
  });
});
