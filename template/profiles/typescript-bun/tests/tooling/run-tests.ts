import { realpathSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const project = realpathSync(".");
const behaviorRoot = "tests/behavior/";
const contractFile = "tests/tooling/contracts/profile.test.ts";
const qualificationFile = "tests/tooling/qualification/profile.test.ts";
const testPatterns = new Bun.Glob(
  "{src,tests}/**/*{.test,_test,.spec,_spec}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
);
const files = Array.from(testPatterns.scanSync({ cwd: project, dot: true })).sort();
const behavior = files.filter((file) => file.startsWith(behaviorRoot) && file.endsWith(".test.ts"));

if (behavior.length === 0) {
  throw new Error("No behavior tests found under tests/behavior/**/*.test.ts");
}

const unexpected = files.filter(
  (file) => !behavior.includes(file) && file !== contractFile && file !== qualificationFile,
);
if (unexpected.length > 0) {
  throw new Error(`Test files outside the declared suites: ${unexpected.join(", ")}`);
}
for (const required of [contractFile, qualificationFile]) {
  if (!files.includes(required)) throw new Error(`Missing required test suite: ${required}`);
}

async function run(tests: string[]): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "rill-bun-report-"));
  try {
    const report = join(directory, "bun.xml");
    const child = Bun.spawnSync(
      [
        process.execPath,
        "test",
        "--reporter=junit",
        `--reporter-outfile=${report}`,
        ...tests.map((file) => `./${file}`),
      ],
      { stdout: "inherit", stderr: "inherit", env: { ...process.env, CI: "1" } },
    );
    if (child.exitCode !== 0) process.exitCode = child.exitCode ?? 1;
    if (child.exitCode !== 0) return;

    const executed: string[] = [];
    const incomplete: string[] = [];
    new HTMLRewriter()
      .on("testsuites > testsuite", {
        element(suite) {
          const file = suite.getAttribute("file");
          if (!file) throw new Error("Bun JUnit suite has no file");
          const path = relative(project, realpathSync(file));
          executed.push(path);
          if (Number(suite.getAttribute("tests")) < 1 || suite.getAttribute("skipped") !== "0") {
            incomplete.push(path);
          }
        },
      })
      .transform(await Bun.file(report).text());

    if (JSON.stringify(executed.sort()) !== JSON.stringify([...tests].sort())) {
      throw new Error(
        `Bun test discovery mismatch. Expected ${tests.join(", ")}. Ran ${executed.join(", ")}.`,
      );
    }
    if (incomplete.length > 0) {
      throw new Error(`Bun tests skipped or absent in: ${incomplete.join(", ")}`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

switch (process.argv[2]) {
  case "ordinary":
    await run([...behavior, contractFile]);
    break;
  case "behavior":
    await run(behavior);
    break;
  case "qualification":
    await run([...behavior, contractFile]);
    if (!process.exitCode) await run([qualificationFile]);
    break;
  default:
    throw new Error("Specify ordinary, behavior or qualification");
}
