import { expect, test } from "@playwright/test";

test("foundation page and health boundary are available", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Lab Platform");
  await expect(page.getByRole("heading", { name: "Lab Platform" })).toBeVisible();

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(health.headers()["cache-control"]).toBe("no-store");
  await expect(health.json()).resolves.toMatchObject({
    status: "ok",
    service: "lab-platform",
  });
});
