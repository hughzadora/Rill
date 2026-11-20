import { expect, test } from "@playwright/test";

test("production page loads without browser errors and responds to clicks", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto("/");
  await expect(page).toHaveTitle("Rill UI quality fixture");
  await expect(page.getByRole("heading", { name: "UI quality gate" })).toBeVisible();
  const status = page.getByRole("status");
  await expect(status).toHaveText("Clicks: 0");

  await page.getByRole("button", { name: "Increment counter" }).click();
  await expect(status).toHaveText("Clicks: 1");
  await page.getByRole("button", { name: "Increment counter" }).click();
  await expect(status).toHaveText("Clicks: 2");

  expect(consoleErrors).toEqual([]);
});
