import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8766",
    browserName: "chromium",
    channel: "chrome",
    headless: true,
  },
  webServer: {
    command:
      "pnpm --dir apps/console run build && PORT=8766 node tools/preview.mjs 22 23",
    url: "http://127.0.0.1:8766/",
    reuseExistingServer: false,
    timeout: 15000,
  },
});
