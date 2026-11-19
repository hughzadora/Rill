import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { measureProject } from "../tools/quality-metrics.ts";

const roots: string[] = [];
function git(root: string, ...args: string[]) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
}
function sample() {
  const root = mkdtempSync(join(tmpdir(), "rill-metrics-"));
  roots.push(root);
  mkdirSync(join(root, "tools"));
  writeFileSync(
    join(root, "tools/calc.ts"),
    "export function add(a: number, b: number) { return a + b; }\n",
  );
  git(root, "init", "-q");
  git(root, "add", "tools/calc.ts");
  execFileSync("git", [
    "-C",
    root,
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "user.name=fixture",
    "-c",
    "user.email=fixture@example.test",
    "commit",
    "-qm",
    "baseline",
  ]);
  return root;
}
const config = {
  schemaVersion: 1 as const,
  purpose: "Isolated fixture source coverage",
  sourcePaths: ["tools"],
  optionalSourcePaths: ["vitest.config.ts"],
  extensions: [".ts", ".tsx"],
  limits: {
    maximumCyclomaticComplexity: 15,
    maximumFunctionLines: 50,
    maximumParameters: 6,
    maximumCodeLinesPerFile: 500,
  },
};
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
test("reports a complete passing real Tokei/Lizard baseline", () => {
  const root = sample();
  const result = measureProject(root, config);
  expect(result).toMatchObject({
    passed: true,
    filesExpected: 1,
    filesMeasured: 1,
    lizardAnalyzed: 1,
    missingRoots: [],
    coverage: { missing: [], unexpected: [], duplicates: [] },
    oversize: [],
  });
});
test("a changed source over the complexity threshold fails", () => {
  const root = sample();
  writeFileSync(
    join(root, "tools/calc.ts"),
    [
      "export function decide(n: number) {",
      ...Array.from(
        { length: 18 },
        (_, index) => `  if (n === ${index}) return ${index};`,
      ),
      "  return n;",
      "}",
    ].join("\n"),
  );
  const result = measureProject(root, config);
  expect(result.passed).toBe(false);
  expect(result.lizard.exitCode).toBe(1);
  expect(result.filesMeasured).toBe(result.filesExpected);
  expect(result.lizard.warnings).toContain("decide");
});
test("new TypeScript file outside declared roots fails coverage", () => {
  const root = sample();
  writeFileSync(join(root, "outside.ts"), "export const unmeasured = 1;\n");
  const result = measureProject(root, config);
  expect(result.passed).toBe(false);
  expect(result.filesExpected).toBe(1);
  expect(result.outsideRoots).toEqual(["outside.ts"]);
});

test("missing required source roots never produce a green gate", () => {
  const root = sample();
  expect(() =>
    measureProject(root, {
      ...config,
      sourcePaths: ["nonexistent"],
      optionalSourcePaths: [],
    }),
  ).toThrow("No tracked/untracked source files");
});
