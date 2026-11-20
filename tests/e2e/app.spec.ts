import { expect, test } from "./fixtures";

test("production page loads without browser errors and responds to clicks", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Rill UI quality fixture");
  await expect(page.getByRole("heading", { name: "UI quality gate" })).toBeVisible();

  const status = page.getByRole("status");
  const increment = page.getByRole("button", { name: "Increment counter" });

  await expect(status).toHaveText("Clicks: 0");
  await increment.click();
  await expect(status).toHaveText("Clicks: 1");
  await increment.click();
  await expect(status).toHaveText("Clicks: 2");
});
