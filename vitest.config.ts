import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "quality-fixtures/node/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/ts/**/*.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
