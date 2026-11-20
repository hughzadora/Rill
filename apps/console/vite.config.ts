import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/test-setup.ts",
        "src/vite-env.d.ts",
      ],
      reporter: ["text", "json-summary"],
      // Calibrated below the measured initial product baseline to guard against lost tests;
      // no numeric floor substitutes for actual behavior or code review.
      thresholds: {
        statements: 80,
        branches: 65,
        functions: 75,
        lines: 80,
      },
    },
  },
});
