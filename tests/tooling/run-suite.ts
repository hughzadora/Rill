import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const suites = {
  behavior: {
    directory: "tests/behavior",
    files: ["tests/behavior/template.test.ts"],
  },
  contracts: {
    directory: "tests/tooling/contracts",
    files: ["tests/tooling/contracts/repository.test.ts"],
  },
  qualification: {
    directory: "tests/tooling/qualification",
    files: ["tests/tooling/qualification/gates.test.ts"],
  },
};

const selection = process.argv[2];
if (selection !== "ordinary" && selection !== "behavior" && selection !== "qualification") {
  throw new Error(`Unknown test selection ${selection}`);
}
const selected =
  selection === "ordinary" ? [suites.behavior, suites.contracts] : [suites[selection]];

const files = selected.flatMap(({ directory, files }) => {
  for (const file of files) {
    const input = statSync(join(root, file), { throwIfNoEntry: false });
    if (!input?.isFile() || input.size === 0) throw new Error(`Missing required suite ${file}`);
  }
  const discovered = new Bun.Glob("**/*{.test,_test,.spec,_spec}.*").scanSync({
    cwd: join(root, directory),
    dot: true,
  });
  const actual = [...discovered].map((file) => `${directory}/${file}`).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...files].sort())) {
    throw new Error(`Unexpected suite inventory in ${directory}: ${actual.join(", ")}`);
  }
  return files;
});

const temporary = mkdtempSync(join(tmpdir(), "rill-test-report-"));
try {
  const paths = files.map((file) => `./${file}`);
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
  if (focused.exitCode !== 0) {
    throw new Error(`Bun ${selection} focus check failed\n${focused.stderr.toString()}`);
  }

  const report = join(temporary, "junit.xml");
  const result = Bun.spawnSync(
    [process.execPath, "test", "--reporter=junit", `--reporter-outfile=${report}`, ...paths],
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
  if (JSON.stringify(executed.sort()) !== JSON.stringify([...files].sort())) {
    throw new Error(`Unexpected Bun ${selection} report suites: ${executed.join(", ")}`);
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
