import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DomainInvariantError } from "./errors";
import {
  archiveResource,
  assertCanCreateAssociation,
  isActive,
  isSubscriptionTokenActive,
} from "./lifecycle";

describe("resource lifecycle", () => {
  it.each([
    [{ enabled: true, archivedAt: null }, true],
    [{ enabled: false, archivedAt: null }, false],
    [{ enabled: true, archivedAt: new Date(0) }, false],
    [{ enabled: false, archivedAt: new Date(0) }, false],
  ] as const)("evaluates enabled and archived state", (resource, expected) => {
    expect(isActive(resource)).toBe(expected);
  });

  it("treats expiry as an exclusive boundary for subscription tokens", () => {
    const boundary = new Date("2026-08-01T00:00:00.000Z");

    expect(
      isSubscriptionTokenActive(
        { enabled: true, archivedAt: null, expiresAt: boundary },
        boundary,
      ),
    ).toBe(false);

    fc.assert(
      fc.property(
        fc.date({ noInvalidDate: true }),
        fc.date({ noInvalidDate: true }),
        (now, expiresAt) => {
          expect(
            isSubscriptionTokenActive({ enabled: true, archivedAt: null, expiresAt }, now),
          ).toBe(expiresAt.getTime() > now.getTime());
        },
      ),
    );

    expect(
      isSubscriptionTokenActive(
        { enabled: true, archivedAt: null, expiresAt: null },
        new Date(),
      ),
    ).toBe(true);
    expect(
      isSubscriptionTokenActive(
        { enabled: false, archivedAt: null, expiresAt: null },
        new Date(),
      ),
    ).toBe(false);
  });

  it("allows associations only when every target is active", () => {
    expect(() =>
      assertCanCreateAssociation([
        { kind: "profile", state: { enabled: true, archivedAt: null } },
        { kind: "endpoint", state: { enabled: true, archivedAt: null } },
      ]),
    ).not.toThrow();

    try {
      assertCanCreateAssociation([
        { kind: "profile", state: { enabled: true, archivedAt: null } },
        { kind: "endpoint", state: { enabled: false, archivedAt: null } },
      ]);
      expect.fail("Expected association validation to fail");
    } catch (error) {
      expect(error).toEqual(
        new DomainInvariantError(
          "association_target_inactive",
          "Cannot associate inactive or archived endpoint",
        ),
      );
      expect(error).toMatchObject({ name: "DomainInvariantError" });
    }
  });

  it("archives once, disables the resource, and preserves the first timestamp", () => {
    const resource = { enabled: true, archivedAt: null, name: "Tokyo" };
    const firstArchiveTime = new Date("2026-08-01T00:00:00.000Z");
    const archived = archiveResource(resource, firstArchiveTime);

    expect(archived).toEqual({ enabled: false, archivedAt: firstArchiveTime, name: "Tokyo" });
    expect(archiveResource(archived, new Date("2026-08-02T00:00:00.000Z"))).toBe(archived);
  });
});
