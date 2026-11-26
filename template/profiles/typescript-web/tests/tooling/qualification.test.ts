import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "../..");
const inputs = ["package.json", "playwright.config.ts", "tsconfig.json", "scripts", "src", "tests"];
const reportRoot = join(root, "reports/qualification");

const cases = [
  { name: "valid browser and process suite" },
  {
    name: "skipped keyboard field",
    file: "src/index.html",
    original: '<input id="reminder"',
    replacement: '<input tabindex="-1" id="reminder"',
    diagnostic: /first Tab focuses the reminder field/,
  },
  {
    name: "mobile horizontal overflow",
    file: "src/index.html",
    original: "</head>",
    replacement:
      "<style>@media (max-width: 36rem) { main { min-inline-size: 960px; } }</style></head>",
    diagnostic: /form fits without horizontal overflow/,
  },
  {
    name: "unlabeled button",
    file: "src/index.html",
    original: "</form>",
    replacement: '</form><button type="button" id="unnamed"></button>',
    diagnostic: /"id": "button-name"[\s\S]*"#unnamed"/,
  },
  {
    name: "missing journey from inventory",
    file: "tests/browser/reminders.spec.ts",
    original: 'test("adds a reminder"',
    replacement: 'test("adds a reminder under a changed identity"',
    diagnostic: /Browser inventory mismatch/,
  },
];

for (const candidate of cases) {
  await test(candidate.name, { timeout: 45_000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), "rill-browser-"));
    const reports = join(reportRoot, candidate.name.replaceAll(" ", "-"));
    try {
      for (const file of inputs)
        await cp(join(root, file), join(directory, file), { recursive: true });
      await symlink(join(root, "node_modules"), join(directory, "node_modules"), "dir");
      if (candidate.file) {
        const path = join(directory, candidate.file);
        const source = await readFile(path, "utf8");
        assert.equal(
          source.split(candidate.original).length,
          2,
          `Expected one fault site in ${path}`,
        );
        await writeFile(path, source.replace(candidate.original, candidate.replacement));
      }

      const result = spawnSync("bun", ["run", "test"], {
        cwd: directory,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          TMPDIR: process.env.TMPDIR,
          PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH,
          FORCE_COLOR: "0",
        },
        encoding: "utf8",
        timeout: 40_000,
      });
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
      await rm(reports, { recursive: true, force: true });
      await mkdir(reports, { recursive: true });
      await writeFile(join(reports, "output.log"), output);
      assert.ifError(result.error);
      await cp(join(directory, "reports/browser"), join(reports, "browser"), { recursive: true });
      assert.equal(result.status, candidate.diagnostic ? 1 : 0, output);
      if (candidate.diagnostic) assert.match(output, candidate.diagnostic);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
