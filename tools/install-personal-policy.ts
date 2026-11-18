import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { atomicText } from "./task-context.ts";

const start = "<!-- rill:shared-entry:start -->";
const end = "<!-- rill:shared-entry:end -->";

function isMissing(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export function installPersonalPolicy(
  home: string,
  backups: string,
  options: { migrateBrokenLink?: boolean } = {},
) {
  const entry = join(home, "AGENTS.md");
  let target = entry,
    before = "",
    brokenLink:
      | { linkTarget: string; mode: number; device: number; inode: number }
      | undefined;
  try {
    const metadata = lstatSync(entry);
    if (metadata.isSymbolicLink()) {
      try {
        target = realpathSync(entry);
        before = readFileSync(target, "utf8");
        if (options.migrateBrokenLink)
          throw new Error(
            "Expected broken AGENTS.md symlink for explicit migration",
          );
      } catch (error) {
        if (!isMissing(error)) throw error;
        target = entry;
        const linkTarget = readlinkSync(entry);
        if (!options.migrateBrokenLink)
          throw new Error(
            `Found broken AGENTS.md symlink to ${linkTarget}; review the target and rerun with --migrate-broken-link for explicit migration`,
          );
        brokenLink = {
          linkTarget,
          mode: metadata.mode,
          device: metadata.dev,
          inode: metadata.ino,
        };
      }
    } else before = readFileSync(entry, "utf8");
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  const content = readFileSync(
    new URL(
      "../skills/rill-preferences/references/shared-entry.md",
      import.meta.url,
    ),
    "utf8",
  ).trim();
  const block = `${start}\n${content}\n${end}`;
  const starts = before.split(start).length - 1,
    ends = before.split(end).length - 1;
  if (
    starts !== ends ||
    starts > 1 ||
    (starts === 1 && before.indexOf(start) > before.indexOf(end))
  )
    throw new Error(
      "Rill shared-entry markers conflict; preserve owner content and reconcile",
    );
  const after =
    starts === 1
      ? before.slice(0, before.indexOf(start)) +
        block +
        before.slice(before.indexOf(end) + end.length)
      : `${before}${before.endsWith("\n") || !before ? "" : "\n"}\n${block}\n`;
  const backupValue = brokenLink
    ? `${JSON.stringify(
        {
          schemaVersion: 1,
          kind: "dangling-symlink",
          path: entry,
          linkTarget: brokenLink.linkTarget,
          mode: brokenLink.mode.toString(8),
        },
        null,
        2,
      )}\n`
    : before;
  const digest = createHash("sha256").update(backupValue).digest("hex");
  const backup = join(
    backups,
    `AGENTS.${digest}${brokenLink ? ".symlink.json" : ".md"}`,
  );
  if (after !== before) {
    if (!existsSync(backup)) atomicText(backup, backupValue);
    if (brokenLink) {
      const current = lstatSync(entry);
      if (
        !current.isSymbolicLink() ||
        current.dev !== brokenLink.device ||
        current.ino !== brokenLink.inode
      )
        throw new Error("Broken AGENTS.md symlink changed during migration");
      try {
        realpathSync(entry);
        throw new Error("Broken AGENTS.md symlink changed during migration");
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
      unlinkSync(entry);
    }
    atomicText(target, after);
  }
  return {
    target,
    backup,
    changed: after !== before,
    migratedBrokenLink: Boolean(brokenLink && after !== before),
    source: "shared-entry.md",
    nativeReload: "next session or native instruction reload",
  };
}
if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.some((argument) => argument !== "--migrate-broken-link"))
      throw new Error(
        "Usage: install-personal-policy.ts [--migrate-broken-link]",
      );
    console.log(
      JSON.stringify(
        installPersonalPolicy(
          process.env.CODEX_HOME ?? join(homedir(), ".codex"),
          join(homedir(), ".local/state/rill/install-backups"),
          { migrateBrokenLink: args.includes("--migrate-broken-link") },
        ),
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
