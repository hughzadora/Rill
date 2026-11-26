import { expect, test } from "bun:test";
import { z } from "zod";

const profileFiles = [
  "bun.lock",
  "mise.lock",
  ".dependency-cruiser.cjs",
  ".spectral.yaml",
  "openapi.json",
  "contracts/baseline.json",
  "contracts/baseline-openapi.json",
  "src/server.ts",
  "src/domain/capacity.ts",
  "src/schemas/quotes.ts",
  "src/adapters/http.ts",
  "src/adapters/configuration.ts",
  "scripts/generate-openapi.ts",
  "scripts/check-openapi.ts",
  "scripts/check-mutation.ts",
  "tests/behavior/capacity.test.ts",
  "tests/behavior/configuration.test.ts",
  "tests/behavior/http.test.ts",
  "tests/tooling/qualification/profile.test.ts",
];

test("required authored and generated inputs exist and have content", async () => {
  for (const path of profileFiles) {
    expect((await Bun.file(path).text()).trim().length, path).toBeGreaterThan(0);
  }
});

test("the native task graph executes the activated gates", async () => {
  const task = z.object({ run: z.string().optional(), depends: z.array(z.string()).optional() });
  const { tasks } = z
    .object({ tasks: z.record(z.string(), task) })
    .parse(Bun.TOML.parse(await Bun.file("mise.toml").text()));
  const { scripts } = z
    .object({ scripts: z.record(z.string(), z.string()) })
    .parse(await Bun.file("package.json").json());

  expect(tasks.verify?.depends).toEqual([
    "check-fast",
    "test",
    "api-contract",
    "unused",
    "spelling",
    "links",
    "scan-secrets",
    "scan-dependencies",
  ]);
  expect(tasks["check-fast"]?.depends).toEqual([
    "format-check",
    "lint",
    "typecheck",
    "architecture",
  ]);
  expect(tasks["api-contract"]?.depends).toEqual([
    "openapi-drift",
    "openapi-lint",
    "openapi-compatibility",
  ]);
  expect(tasks.qualify?.depends).toEqual(["test", "mutation"]);
  const nativeBindings = {
    architecture: "architecture",
    "openapi-drift": "openapi:check",
    "openapi-lint": "openapi:lint",
    "openapi-compatibility": "openapi:compatibility",
    test: "test",
    qualify: "test:qualification",
    mutation: "test:mutation",
  };
  for (const [name, script] of Object.entries(nativeBindings)) {
    expect(tasks[name]?.run, name).toBe(`bun run ${script}`);
    expect(scripts[script]?.trim().length, script).toBeGreaterThan(0);
  }
  expect(scripts["test:behavior"]).toBe(
    `bun test ${profileFiles
      .filter((file) => file.startsWith("tests/behavior/"))
      .map((file) => `./${file}`)
      .join(" ")}`,
  );
});

test("mutation uses the behavior-only runner on the reviewed capacity rule", async () => {
  const configuration: unknown = await Bun.file("stryker.config.json").json();
  expect(configuration).toMatchObject({
    testRunner: "command",
    commandRunner: { command: "bun run test:behavior" },
    coverageAnalysis: "off",
    incremental: false,
    mutate: ["src/domain/capacity.ts"],
    thresholds: { high: 100, low: 100, break: 100 },
  });
});
