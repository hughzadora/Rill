import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "tools/check-metrics.ts"],
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage",
      thresholds: { statements: 80, branches: 80, functions: 85, lines: 80 },
    },
  },
});
