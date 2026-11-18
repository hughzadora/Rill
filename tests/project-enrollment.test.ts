import {
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { enrollProject, leaveProject } from "../tools/project-enrollment.ts";
import { lifecycleEvent } from "../tools/recovery-lifecycle.ts";
import { fixtureProject, taskUrl } from "./helpers/project.ts";

let fixture: ReturnType<typeof fixtureProject>;
beforeEach(() => {
  fixture = fixtureProject();
  for (const [key, value] of Object.entries(fixture.environment))
    vi.stubEnv(key, value);
});
afterEach(() => {
  vi.unstubAllEnvs();
  fixture.cleanup();
});
const signal = () => AbortSignal.timeout(10_000);

test("new unborn project enrolls using actual publisher identity and exits with plugin disabled", async () => {
  rmSync(join(fixture.root, ".rill"), { recursive: true });
  const enrolled = await enrollProject(
    fixture.root,
    "example/project",
    signal(),
  );
  expect(enrolled.publisherId).toBe(1);
  expect(
    JSON.parse(readFileSync(join(fixture.root, ".rill/authority.json"), "utf8"))
      .githubUserIds,
  ).toEqual([1]);
  expect(
    readFileSync(join(fixture.root, ".codex/config.toml"), "utf8"),
  ).toContain("enabled = true");
  await leaveProject(fixture.root, signal());
  expect(
    readFileSync(join(fixture.root, ".codex/config.toml"), "utf8"),
  ).toContain("enabled = false");
  expect(() =>
    readFileSync(join(fixture.root, ".rill/project.json")),
  ).toThrow();
  expect(
    await lifecycleEvent(
      {
        hook_event_name: "SessionStart",
        cwd: fixture.root,
        session_id: "unenrolled",
      },
      signal(),
    ),
  ).toEqual({});
});

test("existing project retains comments, other plugins, commands and owner rules through enroll and exit", async () => {
  mkdirSync(join(fixture.root, ".codex"));
  const before =
    '# owner comment\nmodel_verbosity = "low"\n[plugins."other@fixture"]\nenabled = true\n';
  writeFileSync(join(fixture.root, ".codex/config.toml"), before);
  writeFileSync(join(fixture.root, "AGENTS.md"), "Owner rules remain\n");
  writeFileSync(join(fixture.root, "justfile"), "lint:\n    echo existing\n");
  await enrollProject(fixture.root, "example/project", signal());
  await enrollProject(fixture.root, "example/project", signal());
  await leaveProject(fixture.root, signal());
  const config = readFileSync(join(fixture.root, ".codex/config.toml"), "utf8");
  expect(config).toContain(before.trim());
  expect(config.match(/\[plugins\."rill@rill-local"\]/g)).toHaveLength(1);
  expect(config).toContain("enabled = false");
  expect(readFileSync(join(fixture.root, "AGENTS.md"), "utf8")).toBe(
    "Owner rules remain\n",
  );
  expect(readFileSync(join(fixture.root, "justfile"), "utf8")).toBe(
    "lint:\n    echo existing\n",
  );
});

test("exit preserves enrollment and unsynchronized facts rather than abandoning them", async () => {
  expect(fixture.run("sync", taskUrl).status).toBe(0);
  const record = fixture.record();
  expect(fixture.run("record", fixture.recordPath(record)).status).toBe(0);
  await expect(leaveProject(fixture.root, signal())).rejects.toThrow("pending");
  expect(
    readFileSync(join(fixture.root, ".rill/project.json"), "utf8"),
  ).toContain("example/project");
});

test("enrollment refuses repository and authorized-publisher conflicts before config writes", async () => {
  await expect(
    enrollProject(fixture.root, "different/repository", signal()),
  ).rejects.toThrow("repository");
  fixture.state.principal.id = 999;
  fixture.save();
  await expect(
    enrollProject(fixture.root, "example/project", signal()),
  ).rejects.toThrow("publisher");
  expect(() =>
    readFileSync(join(fixture.root, ".codex/config.toml")),
  ).toThrow();
});

test("shared project config symlinks are preserved instead of editing another checkout", async () => {
  mkdirSync(join(fixture.root, ".codex"));
  const shared = join(fixture.directory, "shared.toml");
  writeFileSync(shared, '# shared owner config\nmodel_verbosity = "low"\n');
  symlinkSync(shared, join(fixture.root, ".codex/config.toml"));
  await expect(
    enrollProject(fixture.root, "example/project", signal()),
  ).rejects.toThrow("symlink");
  expect(readFileSync(shared, "utf8")).toBe(
    '# shared owner config\nmodel_verbosity = "low"\n',
  );
});
