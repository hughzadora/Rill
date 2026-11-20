import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/ts/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**"],
    coverage: {
      provider: "v8",
      include: ["src/ts/**/*.{ts,tsx}"],
      exclude: ["src/ts/main.tsx", "**/*.d.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
