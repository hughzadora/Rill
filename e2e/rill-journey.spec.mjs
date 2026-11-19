import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/rill-journey.html");
});

test("the owner sees the lifecycle and can inspect a design stage", async ({
  page,
}) => {
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "你只负责判断结果",
  );
  await expect(
    page.getByRole("region", { name: "你的三次检查" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /03 可交互设计/ }).click();
  await expect(page.locator("#stage-title")).toHaveText("可交互设计");
  await expect(page.locator("#stage-link")).toHaveAttribute(
    "href",
    "https://github.com/hughzadora/Rill/issues/25",
  );
});

test("the task filter displays only real owner-facing child issues", async ({
  page,
}) => {
  await page.getByRole("button", { name: "面向用户" }).click();
  await expect(page.locator(".ticket:visible")).toHaveCount(2);
  await expect(page.locator(".ticket:visible .ticket-id")).toHaveText([
    "#25",
    "#26",
  ]);
  await expect(page.getByRole("button", { name: "面向用户" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "全部" }).click();
  await expect(page.locator(".ticket:visible")).toHaveCount(6);
});

test("mobile layout fits and does not impersonate a native approval", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(
    page.getByRole("button", { name: "查看验收阶段" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "查看验收阶段" }).click();
  await expect(page.locator("#stage-title")).toHaveText("复测与人工检查");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    375,
  );
  await expect(page.locator("form")).toHaveCount(0);
});
