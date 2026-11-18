import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";
import { installPersonalPolicy } from "../tools/install-personal-policy.ts";

const fsFaults = vi.hoisted(() => ({
  beforeEntryLstat: undefined as ((path: string) => void) | undefined,
  beforeTargetRead: undefined as ((path: string) => void) | undefined,
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    lstatSync: ((path: string, ...args: unknown[]) => {
      fsFaults.beforeEntryLstat?.(path);
      return actual.lstatSync(
        path,
        ...(args as Parameters<typeof actual.lstatSync> extends [
          unknown,
          ...infer Rest,
        ]
          ? Rest
          : never),
      );
    }) as typeof actual.lstatSync,
    readFileSync: ((path: string, ...args: unknown[]) => {
      fsFaults.beforeTargetRead?.(path.toString());
      return actual.readFileSync(
        path,
        ...(args as Parameters<typeof actual.readFileSync> extends [
          unknown,
          ...infer Rest,
        ]
          ? Rest
          : never),
      );
    }) as typeof actual.readFileSync,
  };
});

test("shared entry preserves a symlink and owner bytes, updates idempotently and backs up original", () => {
  const root = mkdtempSync(join(tmpdir(), "rill-policy-"));
  try {
    const home = join(root, "codex"),
      target = join(root, "owner.md");
    mkdirSync(home);
    writeFileSync(target, "# Existing owner rules\nKeep these bytes.\n");
    symlinkSync(target, join(home, "AGENTS.md"));
    const first = installPersonalPolicy(home, join(root, "backups"));
    expect(first.target).toBe(target);
    expect(readFileSync(first.backup, "utf8")).toBe(
      "# Existing owner rules\nKeep these bytes.\n",
    );
    const content = readFileSync(target, "utf8");
    expect(content).toContain("Keep these bytes.\n");
    expect(content).toContain("native interactive");
    expect(installPersonalPolicy(home, join(root, "backups")).changed).toBe(
      false,
    );
    writeFileSync(target, `${content}\nOwner added a new rule.\n`);
    installPersonalPolicy(home, join(root, "backups"));
    expect(readFileSync(target, "utf8")).toContain("Owner added a new rule.");
    writeFileSync(
      target,
      "<!-- rill:shared-entry:start -->\nOwner data with missing end marker",
    );
    expect(() => installPersonalPolicy(home, join(root, "backups"))).toThrow(
      "markers",
    );
    expect(readFileSync(target, "utf8")).toContain(
      "Owner data with missing end marker",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dangling AGENTS symlinks fail safely unless metadata migration is explicit", () => {
  const root = mkdtempSync(join(tmpdir(), "rill-policy-broken-link-"));
  try {
    const home = join(root, "codex"),
      backups = join(root, "backups"),
      entry = join(home, "AGENTS.md"),
      removedTarget = join(root, "Rig/config/codex/AGENTS.md");
    mkdirSync(home);
    symlinkSync(removedTarget, entry);

    expect(() => installPersonalPolicy(home, backups)).toThrow(
      "broken AGENTS.md symlink",
    );
    expect(lstatSync(entry).isSymbolicLink()).toBe(true);
    expect(readlinkSync(entry)).toBe(removedTarget);
    expect(existsSync(removedTarget)).toBe(false);

    const result = installPersonalPolicy(home, backups, {
      migrateBrokenLink: true,
    });
    expect(result.migratedBrokenLink).toBe(true);
    expect(lstatSync(entry).isFile()).toBe(true);
    expect(readFileSync(entry, "utf8")).toContain(
      "<!-- rill:shared-entry:start -->",
    );
    const metadata = JSON.parse(readFileSync(result.backup, "utf8"));
    expect(metadata).toMatchObject({
      kind: "dangling-symlink",
      path: entry,
      linkTarget: removedTarget,
    });
    expect(existsSync(removedTarget)).toBe(false);
    expect(installPersonalPolicy(home, backups).changed).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("migration preserves a symlink target restored before unlink", () => {
  const root = mkdtempSync(join(tmpdir(), "rill-policy-restored-link-"));
  try {
    const home = join(root, "codex"),
      backups = join(root, "backups"),
      entry = join(home, "AGENTS.md"),
      ownerTarget = join(root, "owner.md");
    mkdirSync(home);
    symlinkSync(ownerTarget, entry);
    let entryChecks = 0;
    fsFaults.beforeEntryLstat = (path) => {
      if (path === entry && ++entryChecks === 2)
        writeFileSync(ownerTarget, "Restored owner instructions.\n");
    };
    try {
      expect(() =>
        installPersonalPolicy(home, backups, { migrateBrokenLink: true }),
      ).toThrow("changed during migration");
    } finally {
      fsFaults.beforeEntryLstat = undefined;
    }

    expect(lstatSync(entry).isSymbolicLink()).toBe(true);
    expect(readlinkSync(entry)).toBe(ownerTarget);
    expect(readFileSync(ownerTarget, "utf8")).toBe(
      "Restored owner instructions.\n",
    );
    expect(existsSync(home)).toBe(true);
    expect(readFileSync(join(home, "AGENTS.md"), "utf8")).toBe(
      "Restored owner instructions.\n",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ENOENT after resolving a symlink migrates the entry instead of recreating its target", () => {
  const root = mkdtempSync(join(tmpdir(), "rill-policy-vanished-target-"));
  try {
    const home = join(root, "codex"),
      backups = join(root, "backups"),
      entry = join(home, "AGENTS.md"),
      ownerTarget = join(root, "owner.md");
    mkdirSync(home);
    writeFileSync(ownerTarget, "Owner instructions.\n");
    symlinkSync(ownerTarget, entry);
    fsFaults.beforeTargetRead = (path) => {
      if (path === ownerTarget) {
        rmSync(ownerTarget);
        throw Object.assign(new Error("target disappeared"), {
          code: "ENOENT",
        });
      }
    };

    let result: ReturnType<typeof installPersonalPolicy>;
    try {
      result = installPersonalPolicy(home, backups, {
        migrateBrokenLink: true,
      });
    } finally {
      fsFaults.beforeTargetRead = undefined;
    }

    expect(result.target).toBe(entry);
    expect(result.migratedBrokenLink).toBe(true);
    expect(lstatSync(entry).isFile()).toBe(true);
    expect(readFileSync(entry, "utf8")).toContain(
      "<!-- rill:shared-entry:start -->",
    );
    expect(existsSync(ownerTarget)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("installer CLI exposes explicit dangling-link migration without following the old target", () => {
  const root = mkdtempSync(join(tmpdir(), "rill-policy-cli-"));
  try {
    const home = join(root, "codex"),
      entry = join(home, "AGENTS.md"),
      oldTarget = join(root, "Rig/removed/AGENTS.md"),
      cli = fileURLToPath(
        new URL("../tools/install-personal-policy.ts", import.meta.url),
      );
    mkdirSync(home);
    symlinkSync(oldTarget, entry);
    const env = { ...process.env, HOME: root, CODEX_HOME: home };
    const refused = spawnSync(process.execPath, [cli], {
      env,
      encoding: "utf8",
    });
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain("--migrate-broken-link");
    expect(lstatSync(entry).isSymbolicLink()).toBe(true);

    const migrated = spawnSync(
      process.execPath,
      [cli, "--migrate-broken-link"],
      { env, encoding: "utf8" },
    );
    expect(migrated.status).toBe(0);
    expect(JSON.parse(migrated.stdout)).toMatchObject({
      migratedBrokenLink: true,
      target: entry,
    });
    expect(lstatSync(entry).isFile()).toBe(true);
    expect(existsSync(oldTarget)).toBe(false);
    expect(existsSync(join(root, ".local/state/rill/install-backups"))).toBe(
      true,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
