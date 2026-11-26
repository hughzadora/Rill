import AxeBuilder from "@axe-core/playwright";
import { expect, test as base } from "@playwright/test";
import { launchPreview } from "../process/preview.ts";

const test = base.extend<{ preview: URL }>({
  preview: async ({ request }, use) => {
    const server = launchPreview();
    try {
      const url = await server.ready;
      await expect(await request.get(new URL("/health", url).href)).toBeOK();
      await use(url);
    } finally {
      expect(await server.stop()).toEqual({ code: 0, signal: null });
    }
  },
});

test("adds a reminder", async ({ page, preview }) => {
  await page.goto(preview.href);
  await expect(page.getByRole("heading", { name: "Reminders" })).toBeVisible();
  await page.getByRole("textbox", { name: "Reminder" }).fill("Pick up library books");
  await page.getByRole("button", { name: "Add reminder" }).click();
  await expect(page.getByRole("listitem")).toHaveText("Pick up library books");
});

test("recovers from blank input using only the keyboard", async ({ page, preview }, testInfo) => {
  await page.goto(preview.href);
  const input = page.getByRole("textbox", { name: "Reminder" });
  const add = page.getByRole("button", { name: "Add reminder" });
  const list = page.getByRole("list", { name: "Reminders", includeHidden: true });
  await page.keyboard.press("Tab");
  await expect(input, "first Tab focuses the reminder field").toBeFocused();
  await expect(page.locator(":focus-visible")).toHaveAttribute("id", "reminder");
  await page.keyboard.press("Tab");
  await expect(add).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toHaveText("Enter a reminder.");
  await expect(input).toHaveAccessibleDescription("Enter a reminder.");
  await expect(input).toBeFocused();
  await expect(list.getByRole("listitem")).toHaveCount(0);

  await page.keyboard.type("Set the table");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toBeEmpty();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await expect(list.getByRole("listitem")).toHaveText("Set the table");
  await testInfo.attach("completed-journey", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("fits and reflows the form at the supported viewport", async ({ page, preview, isMobile }) => {
  await page.goto(preview.href);
  const layout = await page.locator("form").evaluate((form) => {
    const input = form.querySelector("input");
    const button = form.querySelector("button");
    if (!input || !button) throw new Error("Missing responsive layout controls");
    return {
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      inputTop: input.getBoundingClientRect().top,
      inputBottom: input.getBoundingClientRect().bottom,
      buttonTop: button.getBoundingClientRect().top,
    };
  });
  expect(layout.content, "form fits without horizontal overflow").toBeLessThanOrEqual(
    layout.viewport,
  );
  if (isMobile) {
    expect(layout.buttonTop, "mobile stacks the button below the field").toBeGreaterThanOrEqual(
      layout.inputBottom,
    );
  } else {
    expect(layout.buttonTop, "desktop places the button beside the field").toBe(layout.inputTop);
  }
});

test("passes axe in empty, invalid and populated states", async ({ page, preview }, testInfo) => {
  await page.goto(preview.href);
  const add = page.getByRole("button", { name: "Add reminder" });
  const input = page.getByRole("textbox", { name: "Reminder" });
  for (const state of ["empty", "invalid", "populated"]) {
    if (state === "invalid") await add.click();
    if (state === "populated") {
      await input.fill("Call the library");
      await add.click();
      await expect(page.getByRole("listitem")).toHaveText("Call the library");
    }
    const audit = await new AxeBuilder({ page }).analyze();
    await testInfo.attach(`axe-${state}`, {
      body: JSON.stringify(audit),
      contentType: "application/json",
    });
    expect(
      audit.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })),
      `axe violations in ${state} state`,
    ).toEqual([]);
  }
});
