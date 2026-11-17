import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    allowOnly: false,
    passWithNoTests: false,
    retry: 0,
    isolate: true,
    reporters: ["default", "json"],
    outputFile: { json: ".cache/ci/vitest.json" },
  },
});
