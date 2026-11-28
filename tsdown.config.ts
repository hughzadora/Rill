import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    template: "src/template.ts",
    env: "src/env.ts",
  },
  outDir: "dist/lib",
  format: "esm",
  target: "node24",
  clean: true,
  dts: true,
  shims: true,
  minify: false,
  sourcemap: true,
});
