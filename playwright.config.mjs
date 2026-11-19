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
      "python3 -m http.server 8766 --bind 127.0.0.1 --directory prototype",
    url: "http://127.0.0.1:8766/rill-journey.html",
    reuseExistingServer: false,
    timeout: 15000,
  },
});
