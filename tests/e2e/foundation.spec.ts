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

test("control surface fails closed without an administrator session", async ({ page }) => {
  const response = await page.goto("/control");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Authenticated administrator surface")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Control Plane" })).toHaveCount(0);
});
