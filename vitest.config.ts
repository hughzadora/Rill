import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/ts/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/ts/**/*.{ts,tsx}"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
