import { globSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Activate the published matrix thresholds when there is production code to measure.
const hasProductionSource = globSync("src/**/*.ts").length > 0;

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage",
      ...(hasProductionSource
        ? { thresholds: { statements: 80, branches: 80, functions: 85, lines: 80 } }
        : {}),
    },
  },
});
