import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    const runtimeErrors: string[] = [];

    page.on("pageerror", (error) => {
      runtimeErrors.push(`Uncaught pageerror: ${error.message}`);
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        runtimeErrors.push(`Console error: ${msg.text()}`);
      }
    });

    page.on("response", (response) => {
      if (response.status() >= 500) {
        runtimeErrors.push(`HTTP ${response.status()} on ${response.url()}`);
      }
    });

    await use(page);

    expect(
      runtimeErrors,
      `Detected runtime errors during E2E execution:\n${runtimeErrors.join("\n")}`,
    ).toEqual([]);
  },
});

export { expect };
