import { realpathSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const project = realpathSync(".");
const behavior = [
  "tests/behavior/capacity.test.ts",
  "tests/behavior/configuration.test.ts",
  "tests/behavior/http.test.ts",
];
const contracts = "tests/tooling/contracts/profile.test.ts";
const qualification = "tests/tooling/qualification/profile.test.ts";
const expected = [...behavior, contracts, qualification].sort();

const testNames = new Bun.Glob(
  "{src,scripts,tests}/**/*{.test,_test,.spec,_spec}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
);
const discovered = Array.from(testNames.scanSync({ cwd: project, dot: true })).sort();
if (JSON.stringify(discovered) !== JSON.stringify(expected)) {
  throw new Error(
    `Test inventory mismatch. Expected ${expected.join(", ")}; found ${discovered.join(", ")}`,
  );
}

async function run(files: string[]) {
  const directory = await mkdtemp(join(tmpdir(), "rill-api-junit-"));
  try {
    const report = join(directory, "results.xml");
    const result = Bun.spawnSync(
      [
        process.execPath,
        "test",
        "--reporter=junit",
        `--reporter-outfile=${report}`,
        ...files.map((file) => `./${file}`),
      ],
      { stdout: "inherit", stderr: "inherit", env: { ...process.env, CI: "1" } },
    );
    if (!result.success) throw new Error(`Bun test failed with exit code ${result.exitCode}`);

    const executed: string[] = [];
    new HTMLRewriter()
      .on("testsuites > testsuite", {
        element(suite) {
          const file = suite.getAttribute("file");
          if (
            !file ||
            Number(suite.getAttribute("tests")) < 1 ||
            suite.getAttribute("skipped") !== "0"
          ) {
            throw new Error("Bun reported an empty, skipped or unidentified test suite");
          }
          executed.push(relative(project, realpathSync(file)));
        },
      })
      .transform(await Bun.file(report).text());
    if (JSON.stringify(executed.sort()) !== JSON.stringify([...files].sort())) {
      throw new Error(`Bun test report inventory mismatch. Executed ${executed.join(", ")}`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

switch (process.argv[2]) {
  case "ordinary":
    await run([...behavior, contracts]);
    break;
  case "qualification":
    await run([qualification]);
    break;
  default:
    throw new Error("Specify ordinary or qualification");
}
