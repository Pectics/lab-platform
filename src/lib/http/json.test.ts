import { describe, expect, it } from "vitest";
import { jsonResponse } from "./json";

describe("jsonResponse", () => {
  it("serializes JSON and applies secure no-store defaults", async () => {
    const response = jsonResponse({ ok: true });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
  });

  it("preserves explicit status and header overrides", async () => {
    const response = jsonResponse(
      { error: "unavailable" },
      {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Type": "application/problem+json",
        },
      },
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(await response.json()).toEqual({ error: "unavailable" });
  });
});
