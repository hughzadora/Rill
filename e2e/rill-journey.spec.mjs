import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/progress", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
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

test("GitHub refresh renders the authoritative child state without granting approval", async ({
  page,
}) => {
  const child = (number, state) => ({
    number,
    title: "Feature " + number,
    state,
    url: "https://github.com/hughzadora/Rill/issues/" + number,
  });
  await page.route("**/api/progress", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "github-graphql",
        fetchedAt: "2026-11-19T08:40:00Z",
        parent: {
          number: 22,
          subIssues: { nodes: [child(24, "OPEN"), child(25, "CLOSED")] },
        },
        bugs: { subIssues: { nodes: [child(31, "OPEN")] } },
      }),
    }),
  );
  await page.getByRole("button", { name: "刷新 GitHub 状态" }).click();
  await expect(page.locator("#progress-status")).toContainText(
    "开放子任务 1/2",
  );
  await expect(page.locator("#progress-status")).toContainText("待处理 Bug 1");
  await expect(page.locator(".ticket:visible")).toHaveCount(2);
  await expect(
    page.locator(".ticket").filter({ hasText: "Feature 25" }).locator(".state"),
  ).toHaveText("CLOSED");
  await expect(page.locator("form")).toHaveCount(0);
});

test("GitHub failure is visible and never claimed as a successful refresh", async ({
  page,
}) => {
  await page.getByRole("button", { name: "刷新 GitHub 状态" }).click();
  await expect(page.locator("#progress-status")).toContainText(
    "GitHub 同步失败",
  );
  await expect(page.locator(".ticket:visible")).toHaveCount(6);
});

test("a failed refresh after a successful one marks the retained data as stale", async ({
  page,
}) => {
  await expect(page.locator("#progress-status")).toContainText(
    "GitHub 同步失败",
  );
  let attempts = 0;
  await page.route("**/api/progress", (route) => {
    attempts += 1;
    if (attempts > 1) {
      return route.fulfill({ status: 503, body: "{}" });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "github-graphql",
        fetchedAt: "2026-11-19T08:40:00Z",
        parent: {
          number: 22,
          subIssues: {
            nodes: [
              {
                number: 25,
                title: "Test task",
                state: "CLOSED",
                url: "https://github.com/hughzadora/Rill/issues/25",
              },
            ],
          },
        },
        bugs: { subIssues: { nodes: [] } },
      }),
    });
  });
  await page.getByRole("button", { name: "刷新 GitHub 状态" }).click();
  await expect(page.locator("#progress-status")).toContainText("GitHub 已同步");
  await page.getByRole("button", { name: "刷新 GitHub 状态" }).click();
  await expect(page.locator("#progress-status")).toContainText("可能已经过时");
  await expect(page.locator(".ticket:visible")).toHaveCount(1);
  await expect(page.locator(".ticket:visible .state")).toHaveText("CLOSED");
});
