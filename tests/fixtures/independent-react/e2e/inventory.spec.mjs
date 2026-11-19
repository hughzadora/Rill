import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("@e2e real Chrome inventory purchase flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Available stock: 0");
  await page.getByRole("button", { name: "Ship" }).click();
  await expect(page.getByRole("alert")).toContainText("Cannot ship");
  await page.getByRole("button", { name: "Restock" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Available stock: 1");
});

test("@a11y real Chrome WCAG A/AA", async ({ page }) => {
  await page.goto("/");
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(report.violations).toEqual([]);
});
