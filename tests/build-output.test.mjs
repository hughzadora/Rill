import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const factory = fileURLToPath(new URL("../", import.meta.url));

test("a real build removes obsolete emitted JS and assets without deleting source or unrelated files", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "rill-clean-build-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const name of ["package.json", "pnpm-lock.yaml", "tsconfig.json"]) {
    cpSync(join(factory, name), join(directory, name));
  }
  mkdirSync(join(directory, "src"), { recursive: true });
  mkdirSync(join(directory, "dist/assets"), { recursive: true });

  writeFileSync(join(directory, "src/real.ts"), "export const current = 42;\n");
  writeFileSync(join(directory, "dist/assets/stale.js"), "export const obsolete = true;\n");
  writeFileSync(join(directory, "dist/index.html"), "<p>Old Rill output</p>\n");
  writeFileSync(join(directory, "keep.txt"), "Independent consumer data\n");

  const env = {
    ...process.env,
    NODE_TEST_CONTEXT: undefined,
    NODE_TEST_PIPE: undefined,
    NODE_V8_COVERAGE: undefined,
  };
  // The isolated fixture runs the actual build with the factory's installed,
  // lockfile-backed tools; it does not need a nested network installation.
  symlinkSync(join(factory, "node_modules"), join(directory, "node_modules"), "dir");

  const build = spawnSync("pnpm", ["run", "build"], {
    cwd: directory,
    env,
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.equal(build.status, 0, build.stdout + build.stderr);
  assert.equal(existsSync(join(directory, "dist/assets/stale.js")), false);
  assert.equal(existsSync(join(directory, "dist/index.html")), false);
  assert.equal(existsSync(join(directory, "dist/real.js")), true);
  assert.equal(
    readFileSync(join(directory, "src/real.ts"), "utf8"),
    "export const current = 42;\n",
  );
  assert.equal(readFileSync(join(directory, "keep.txt"), "utf8"), "Independent consumer data\n");

  writeFileSync(join(directory, "dist/stale-again.js"), "export const obsoleteAgain = true;\n");
  const repeated = spawnSync("pnpm", ["run", "build"], {
    cwd: directory,
    env,
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.equal(repeated.status, 0, repeated.stdout + repeated.stderr);
  assert.equal(existsSync(join(directory, "dist/stale-again.js")), false);
  assert.equal(existsSync(join(directory, "dist/real.js")), true);

  // A stale output symlink must not cause the build to delete its target.
  const consumerData = join(directory, "independent-user-data");
  mkdirSync(consumerData);
  writeFileSync(join(consumerData, "do-not-delete.txt"), "preserved\n");
  rmSync(join(directory, "dist"), { recursive: true, force: true });
  symlinkSync(consumerData, join(directory, "dist"), "dir");
  const symlinkBuild = spawnSync("pnpm", ["run", "build"], {
    cwd: directory,
    env,
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.equal(symlinkBuild.status, 0, symlinkBuild.stdout + symlinkBuild.stderr);
  assert.equal(readFileSync(join(consumerData, "do-not-delete.txt"), "utf8"), "preserved\n");
  assert.equal(existsSync(join(directory, "dist/real.js")), true);
});
