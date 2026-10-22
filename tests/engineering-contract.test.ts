import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import { expect, test } from "vitest";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  scripts: Record<string, string>;
};

const schema = {
  type: "object",
  required: ["private", "type", "packageManager", "engines", "scripts", "devDependencies"],
  properties: {
    private: { const: true },
    type: { const: "module" },
    packageManager: { type: "string", pattern: "^pnpm@[0-9]+\\.[0-9]+\\.[0-9]+$" },
    scripts: {
      type: "object",
      required: ["check", "check:format", "check:biome", "check:markdown", "typecheck", "test"],
      additionalProperties: { type: "string" },
    },
    devDependencies: {
      type: "object",
      required: ["typescript", "@biomejs/biome", "vitest", "@vitest/coverage-v8", "ajv"],
    },
  },
} as const;

const validate = new Ajv({ allErrors: true }).compile(schema);

test("real package manifest satisfies the toolchain JSON Schema", () => {
  expect(validate(manifest), JSON.stringify(validate.errors)).toBe(true);
});

test("Ajv rejects a manifest that cannot run TypeScript diagnostics", () => {
  const invalid = structuredClone(manifest);
  delete invalid.scripts.typecheck;
  expect(validate(invalid)).toBe(false);
  expect(validate.errors).toEqual(
    expect.arrayContaining([expect.objectContaining({ keyword: "required" })]),
  );
});
