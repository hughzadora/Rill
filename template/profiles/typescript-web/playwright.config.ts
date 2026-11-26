import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "reminders.spec.ts",
  forbidOnly: true,
  retries: 0,
  timeout: 15_000,
  expect: { timeout: 2000 },
  outputDir: "reports/browser/artifacts",
  reporter: [
    ["list"],
    ["json", { outputFile: "reports/browser/results.json" }],
    ["./tests/tooling/browser-inventory.ts"],
  ],
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
