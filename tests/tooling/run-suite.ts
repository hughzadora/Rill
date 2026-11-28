import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

type Selection = "ordinary" | "behavior" | "qualification";

const directories: Record<Selection, string[]> = {
  ordinary: ["tests/behavior", "tests/tooling/contracts"],
  behavior: ["tests/behavior"],
  qualification: ["tests/tooling/qualification"],
};

const selectionRaw = process.argv[2];
let selection: Selection;
switch (selectionRaw) {
  case "ordinary":
  case "behavior":
  case "qualification":
    selection = selectionRaw;
    break;
  default:
    throw new Error(`Unknown test selection ${selectionRaw}`);
}
const selectedDirs = directories[selection];

const requiredFiles: Record<Selection, string[]> = {
  ordinary: ["tests/behavior/template.test.ts", "tests/tooling/contracts/repository.test.ts"],
  behavior: ["tests/behavior/template.test.ts"],
  qualification: ["tests/tooling/qualification/gates.test.ts"],
};

for (const file of requiredFiles[selection]) {
  const input = statSync(join(root, file), { throwIfNoEntry: false });
  if (!input?.isFile() || input.size === 0) throw new Error(`Missing required suite ${file}`);
}

const expected = [
  ...new Set(
    selectedDirs.flatMap((dir: string) =>
      [
        ...new Bun.Glob("**/*{.test,_test,.spec,_spec}.*").scanSync({
          cwd: join(root, dir),
          dot: true,
        }),
      ].map((file: string) => `${dir}/${file}`),
    ),
  ),
].sort();

for (const file of expected) {
  const input = statSync(join(root, file), { throwIfNoEntry: false });
  if (!input?.isFile() || input.size === 0) throw new Error(`Missing required suite ${file}`);
}

const temporary = mkdtempSync(join(tmpdir(), "rill-test-report-"));
try {
  const paths = expected.map((file) => `./${file}`);
  if (paths.length === 0) throw new Error(`No test suites discovered for ${selection}`);

  const focusedReport = join(temporary, "focused.xml");
  const focused = Bun.spawnSync(
    [
      process.execPath,
      "test",
      "--only",
      "--reporter=junit",
      `--reporter-outfile=${focusedReport}`,
      ...paths,
    ],
    { cwd: root },
  );
  if (existsSync(focusedReport)) throw new Error(`Focused Bun tests in ${selection} suites`);
  if (focused.exitCode !== 0)
    throw new Error(`Bun ${selection} focus check failed\n${focused.stderr.toString()}`);

  const report = join(temporary, "junit.xml");
  const timeout = selection === "qualification" ? ["--timeout=120000"] : [];
  const result = Bun.spawnSync(
    [
      process.execPath,
      "test",
      "--reporter=junit",
      `--reporter-outfile=${report}`,
      ...timeout,
      ...paths,
    ],
    { cwd: root, stdout: "inherit", stderr: "inherit" },
  );
  if (result.exitCode !== 0) throw new Error(`Bun ${selection} suite failed (${result.exitCode})`);

  const executed = [...readFileSync(report, "utf8").matchAll(/<testsuite (.*?)>/gs)].map(
    ([, attributes]) => {
      const file = attributes?.match(/\bfile="([^"]+)"/)?.[1];
      const count = Number(attributes?.match(/\btests="(\d+)"/)?.[1]);
      if (!file || !(count > 0) || !/\bskipped="0"/.test(attributes ?? "")) {
        throw new Error(`Required suite must execute without skips: ${file}`);
      }
      return file;
    },
  );
  if (JSON.stringify([...new Set(executed)].sort()) !== JSON.stringify([...expected].sort())) {
    throw new Error(`Unexpected Bun ${selection} report suites: ${executed.join(", ")}`);
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
