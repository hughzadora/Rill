import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TaskRecord } from "../../tools/task-context.ts";

const stamp = "2026-11-18T00:00:00Z";
export const taskUrl = "https://github.com/example/project/issues/7";
export function fixtureProject() {
  const directory = mkdtempSync(join(tmpdir(), "rill-test-"));
  const root = join(directory, "project");
  const bin = join(directory, "bin");
  mkdirSync(root);
  mkdirSync(bin);
  execFileSync("git", ["init", "-q", root]);
  mkdirSync(join(root, ".rill"));
  writeFileSync(
    join(root, ".rill/project.json"),
    JSON.stringify({ schemaVersion: 1, repository: "example/project" }),
  );
  writeFileSync(
    join(root, ".rill/authority.json"),
    JSON.stringify({ schemaVersion: 1, githubUserIds: [1] }),
  );
  const gh = fileURLToPath(new URL("../fixtures/gh.ts", import.meta.url));
  chmodSync(gh, 0o755);
  symlinkSync(gh, join(bin, "gh"));
  const statePath = join(directory, "remote.json");
  const state = {
    principal: { id: 1, login: "example" },
    offline: false,
    failAfterPost: false,
    mismatchReadback: false,
    invalidIdentity: false,
    issue: {
      number: 7,
      html_url: taskUrl,
      body: "Approved requirements: retain R-7; exclude deployment",
      state: "open",
      updated_at: stamp,
    },
    pages: [
      [{ id: 1, body: "first page", updated_at: stamp }],
      [{ id: 2, body: "last-page requirement R-7", updated_at: stamp }],
    ],
    nextId: 3,
    posts: 0,
  };
  const save = () => writeFileSync(statePath, JSON.stringify(state));
  const reload = () =>
    Object.assign(state, JSON.parse(readFileSync(statePath, "utf8")));
  save();
  const environment = {
    PATH: `${bin}:${process.env.PATH ?? ""}`,
    RILL_FIXTURE_STATE: statePath,
  };
  const cli = fileURLToPath(
    new URL("../../tools/task-context.ts", import.meta.url),
  );
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [cli, ...args], {
      cwd: root,
      env: { ...process.env, ...environment },
      encoding: "utf8",
    });
  const record = (): TaskRecord => ({
    schemaVersion: 1,
    id: randomUUID(),
    taskUrl,
    kind: "checkpoint",
    createdAt: stamp,
    revision: null,
    source: { threadId: "test-owned-source" },
    payload: { requirementIds: ["R-7"], excludedFeature: "deployment" },
  });
  const recordPath = (value: unknown) => {
    const file = join(directory, `${randomUUID()}.json`);
    writeFileSync(file, JSON.stringify(value));
    return file;
  };
  return {
    root,
    directory,
    environment,
    state,
    save,
    reload,
    run,
    record,
    recordPath,
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}
