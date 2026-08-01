import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const originalRevision = process.env.VERCEL_GIT_COMMIT_SHA;

afterEach(() => {
  if (originalRevision === undefined) {
    delete process.env.VERCEL_GIT_COMMIT_SHA;
  } else {
    process.env.VERCEL_GIT_COMMIT_SHA = originalRevision;
  }
});

describe("GET /api/health", () => {
  it("returns a development revision when deployment metadata is absent", async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA;

    await expect(GET().json()).resolves.toEqual({
      status: "ok",
      service: "lab-platform",
      revision: "development",
    });
  });

  it("reports the immutable deployment revision", async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "0123456789abcdef";

    await expect(GET().json()).resolves.toEqual({
      status: "ok",
      service: "lab-platform",
      revision: "0123456789abcdef",
    });
  });
});
