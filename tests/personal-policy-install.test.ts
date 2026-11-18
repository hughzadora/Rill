import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { installPersonalPolicy } from "../tools/install-personal-policy.ts";

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
