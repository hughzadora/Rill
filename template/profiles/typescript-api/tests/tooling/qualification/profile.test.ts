import { expect, test } from "bun:test";
import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const profile = resolve(".");
const excluded = new Set([
  ".git",
  ".stryker-tmp",
  "dist",
  "node_modules",
  "reports",
  "stryker.log",
]);

async function qualify(action: (cwd: string) => Promise<void>) {
  const cwd = await mkdtemp(join(tmpdir(), "rill-api-qualification-"));
  try {
    for (const entry of await readdir(profile)) {
      if (excluded.has(entry) || entry.startsWith(".env")) continue;
      await cp(join(profile, entry), join(cwd, entry), { recursive: true });
    }
    // Real consumer behavior: resolve dependencies with a frozen lockfile rather than
    // symlinking node_modules, which distorts depcruise path matching.
    const installed = Bun.spawnSync([process.execPath, "install", "--frozen-lockfile"], {
      cwd,
      env: { ...process.env, NO_COLOR: "1", CI: "1", MISE_TRUSTED_CONFIG_PATHS: cwd },
    });
    if (!installed.success) {
      throw new Error(`failed to install disposable dependencies: ${installed.stderr.toString()}`);
    }
    await action(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

function command(cwd: string, name: string, ...args: string[]) {
  const executable = name === "bun" ? process.execPath : name;
  const result = Bun.spawnSync([executable, ...args], {
    cwd,
    env: { ...process.env, NO_COLOR: "1", CI: "1", MISE_TRUSTED_CONFIG_PATHS: cwd },
  });
  return {
    success: result.success,
    stdout: result.stdout.toString(),
    output: result.stdout.toString() + result.stderr.toString(),
  };
}

function run(cwd: string, script: string) {
  return command(cwd, "bun", "run", script);
}

function passes(result: ReturnType<typeof run>) {
  expect(result.success, result.output).toBe(true);
}

function rejects(result: ReturnType<typeof run>, diagnostic: string) {
  expect(result.success, result.output).toBe(false);
  expect(result.output).toContain(diagnostic);
}

async function replace(cwd: string, path: string, before: string, after: string) {
  const file = Bun.file(join(cwd, path));
  const content = await file.text();
  expect(content, path).toContain(before);
  await Bun.write(file, content.replace(before, after));
}

test("the pinned parser sees the valid Bun adapter and the real TypeScript alias", async () => {
  await qualify(async (cwd) => {
    const info = run(cwd, "architecture:info");
    passes(info);
    expect(info.output).toMatch(/✔ typescript .*typescript@6\.0\.3/u);
    await Bun.write(
      join(cwd, "src/adapters/qualification.ts"),
      'export { serve } from "bun";\nexport { canAccommodate } from "@/domain/capacity";\n',
    );
    passes(run(cwd, "architecture"));
  });
});

test.each([
  [
    "domain imports a concrete adapter through a deep relative path",
    "src/domain/qualification.ts",
    'export { handleRequest } from "../adapters/http";',
    "domain-stays-pure",
  ],
  [
    "domain imports an adapter type",
    "src/domain/qualification.ts",
    'export type { handleRequest } from "../adapters/http";',
    "domain-stays-pure",
  ],
  [
    "domain reaches an adapter through the real alias",
    "src/domain/qualification.ts",
    'export { handleRequest } from "@/adapters/http";',
    "domain-stays-pure",
  ],
  [
    "domain imports a runtime builtin",
    "src/domain/qualification.ts",
    'export { serve } from "bun";',
    "domain-stays-pure",
  ],
  [
    "schema depends on domain internals",
    "src/schemas/qualification.ts",
    'export { canAccommodate } from "@/domain/capacity";',
    "transport-schemas-stay-independent",
  ],
  [
    "adapter reaches the composition root",
    "src/adapters/qualification.ts",
    'import "../server";',
    "adapters-do-not-import-the-server",
  ],
  [
    "adapter imports an undeclared transitive package",
    "src/adapters/qualification.ts",
    'export { Spectral } from "@stoplight/spectral-core";',
    "no-undeclared-dependencies",
  ],
  [
    "adapter imports a missing module",
    "src/adapters/qualification.ts",
    'export { missing } from "./absent-module";',
    "no-unresolved",
  ],
])("dependency-cruiser rejects when %s", async (_scenario, path, source, rule) => {
  await qualify(async (cwd) => {
    await Bun.write(join(cwd, path), `${source}\n`);
    rejects(run(cwd, "architecture"), `error ${rule}: ${path}`);
  });
});

test("dependency-cruiser rejects a cycle within the otherwise allowed domain", async () => {
  await qualify(async (cwd) => {
    await Bun.write(join(cwd, "src/domain/first.ts"), 'import "./second";\n');
    await Bun.write(join(cwd, "src/domain/second.ts"), 'import "./first";\n');
    rejects(run(cwd, "architecture"), "error no-circular: src/domain/");
  });
});

test("the composed API task fails on a stale generated artifact and passes after regeneration", async () => {
  await qualify(async (cwd) => {
    await replace(cwd, "openapi.json", "Reservation Quote API", "Stale Quote API");
    rejects(command(cwd, "mise", "run", "api-contract"), "OpenAPI drift");
    const generated = run(cwd, "openapi:generate");
    passes(generated);
    await Bun.write(join(cwd, "openapi.json"), generated.stdout);
    passes(command(cwd, "mise", "run", "api-contract"));
  });
});

test("the baseline integrity check detects changes to the archived bytes", async () => {
  await qualify(async (cwd) => {
    await replace(
      cwd,
      "contracts/baseline-openapi.json",
      "Reservation Quote API",
      "Edited Quote API",
    );
    rejects(run(cwd, "openapi:check"), "do not match their recorded SHA-256");
  });
});

test("Spectral rejects an invalid OpenAPI operation", async () => {
  await qualify(async (cwd) => {
    await replace(cwd, "openapi.json", '"responses":', '"invalidResponses":');
    rejects(run(cwd, "openapi:lint"), "oas3-schema");
  });
});

test.each([
  ["wider request range", 101, true],
  ["narrower request range", 10, false],
])("oasdiff evaluates a generated contract with a %s", async (_scenario, maximum, compatible) => {
  await qualify(async (cwd) => {
    await replace(cwd, "src/schemas/quotes.ts", "min(1).max(100)", `min(1).max(${maximum})`);
    const generated = run(cwd, "openapi:generate");
    passes(generated);
    await Bun.write(join(cwd, "openapi.json"), generated.stdout);
    passes(run(cwd, "openapi:check"));
    passes(run(cwd, "openapi:lint"));
    const comparison = run(cwd, "openapi:compatibility");
    if (compatible) passes(comparison);
    else rejects(comparison, "request-property-max-decreased");
  });
});

test("the seeded property rejects an implementation that always accepts", async () => {
  await qualify(async (cwd) => {
    await replace(cwd, "src/domain/capacity.ts", "requested <= available", "true");
    const behavior = command(cwd, "bun", "test", "./tests/behavior/capacity.test.ts");
    rejects(behavior, "Counterexample:");
    expect(behavior.output).toContain("seed: 94191");
  });
});

test("Stryker fails its threshold when superficial tests let mutants survive", async () => {
  await qualify(async (cwd) => {
    const weakTest =
      'import { expect, test } from "bun:test";\ntest("smoke", () => expect(true).toBe(true));\n';
    await Bun.write(join(cwd, "tests/behavior/capacity.test.ts"), weakTest);
    await Bun.write(join(cwd, "tests/behavior/http.test.ts"), weakTest);
    const result = run(cwd, "test:mutation");
    rejects(result, "under breaking threshold 100");
    expect(result.output).toContain("Initial test run succeeded");
  });
}, 30000);

test("discovery rejects removal of the required qualification suite", async () => {
  await qualify(async (cwd) => {
    await rm(join(cwd, "tests/tooling/qualification/profile.test.ts"));
    rejects(run(cwd, "test:qualification"), "Test inventory mismatch");
  });
});

test("native task coverage rejects a missing required architecture task", async () => {
  await qualify(async (cwd) => {
    await replace(cwd, "mise.toml", "[tasks.architecture]", "[tasks.unused-architecture]");
    rejects(run(cwd, "test"), "bun run architecture");
  });
});
