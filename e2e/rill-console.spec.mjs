import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { dashboard } from "./fixtures/dashboard.mjs";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(dashboard),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "把开发流程变成可验证的生产线" }),
  ).toBeVisible();
});

test("the owner sees actual project and verification boundaries", async ({
  page,
}) => {
  await expect(page.getByText("开放工程任务")).toBeVisible();
  await expect(page.getByText("待解决 Bug")).toBeVisible();
  await expect(page.getByText("未达到正式工业交付标准")).toBeVisible();
  await expect(
    page.getByText("当前提交的 CI 尚无可用证明", { exact: false }),
  ).toHaveCount(0);
});

test("task board has real acceptance, blockers and search", async ({
  page,
}) => {
  await page.getByRole("button", { name: /任务执行台/ }).click();
  await expect(
    page.getByRole("heading", { name: "工程任务与交接" }),
  ).toBeVisible();
  await expect(page.locator(".delivery-table tbody tr")).toHaveCount(6);
  await page
    .getByRole("button", { name: /Interactive delivery console/ })
    .click();
  await expect(page.locator(".task-inspector")).toContainText("原生 Issue");
  await expect(page.locator(".task-inspector")).toContainText("阻塞依赖");
  await expect(page.locator(".task-inspector")).toContainText("#31");
  await expect(page.locator(".task-inspector")).toContainText(
    "Real task details",
  );
  await page.getByRole("textbox", { name: "搜索任务" }).fill("continuity");
  await expect(page.locator(".delivery-table tbody tr")).toHaveCount(1);
  await page.getByRole("textbox", { name: "搜索任务" }).fill("");
  await page.getByRole("button", { name: "受阻" }).click();
  await expect(page.locator(".delivery-table tbody tr")).toHaveCount(1);
});

test("quality matrix never inherits a pass from another commit", async ({
  page,
}) => {
  await page.getByRole("button", { name: /质量实验室/ }).click();
  await expect(
    page.getByRole("heading", { name: "质量门禁与测试覆盖" }),
  ).toBeVisible();
  await expect(page.locator(".matrix-table tbody tr")).toHaveCount(4);
  await expect(page.getByText("当前提交暂无托管执行记录")).toBeVisible();
  await expect(page.locator(".gate-required").first()).toHaveText("待验证");
});

test("engineering documents render rich content from versioned sources", async ({
  page,
}) => {
  await page.route("**/api/document?path=PRD.md", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: "# Software factory\n\n## Acceptance\n\n- New project\n- Existing project\n",
    }),
  );
  await page.getByRole("button", { name: /工程文档/ }).click();
  await expect(
    page.getByRole("heading", { name: "项目文档与开发交接" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Software factory" }),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Existing project" }),
  ).toBeVisible();
});

test("pipeline supports stage selection without impersonating approval", async ({
  page,
}) => {
  await page.getByRole("button", { name: /软件流水线/ }).click();
  await expect(
    page.getByRole("heading", { name: "标准化软件交付流水线" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /03 完整设计与取舍/ }).click();
  await expect(page.locator(".phase-detail")).toContainText("Harness 原生选项");
  await expect(page.locator("form")).toHaveCount(0);
});

test("mobile engineering navigation and quality matrix do not overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const name of [
    "质量实验室",
    "任务执行台",
    "工程文档",
    "软件流水线",
    "交付交接",
    "生产总览",
  ]) {
    await page
      .getByRole("button", { name: new RegExp(name) })
      .first()
      .click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(375);
  }
});

test("stale refresh is explicit and retains only observed last state", async ({
  page,
}) => {
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  await page.getByRole("button", { name: "刷新真实状态" }).click();
  await expect(page.getByRole("status")).toContainText("本次同步失败");
  await expect(
    page.getByRole("heading", { name: "把开发流程变成可验证的生产线" }),
  ).toBeVisible();
});

test("every owner-facing view passes Chrome accessibility checks", async ({
  page,
}) => {
  for (const [button, heading] of [
    ["生产总览", "把开发流程变成可验证的生产线"],
    ["任务执行台", "工程任务与交接"],
    ["软件流水线", "标准化软件交付流水线"],
    ["质量实验室", "质量门禁与测试覆盖"],
    ["工程文档", "项目文档与开发交接"],
    ["交付交接", "下一位 Agent 能不能直接接手？"],
  ]) {
    await page
      .getByRole("button", { name: new RegExp(button) })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(result.violations, button).toEqual([]);
  }
});
