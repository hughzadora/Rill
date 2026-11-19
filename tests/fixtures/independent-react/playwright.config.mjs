import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4178",
    channel: "chrome",
    headless: true,
  },
  webServer: {
    command: "pnpm run dev",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
