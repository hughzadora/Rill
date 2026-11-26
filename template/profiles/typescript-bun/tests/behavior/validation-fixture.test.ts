import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../../src/validation-fixture.ts", import.meta.url));

test("the validation fixture preserves argument order, spaces and Unicode", () => {
  const result = Bun.spawnSync([process.execPath, entry, "blue sky", "雪", "--help"]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr.toString()).toBe("");
  expect(result.stdout.toString()).toBe('["blue sky","雪","--help"]\n');
});

test("the validation fixture prints an empty list without arguments", () => {
  const result = Bun.spawnSync([process.execPath, entry]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toBe("[]\n");
});
