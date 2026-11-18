import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { atomicText } from "./task-context.ts";

const start = "<!-- rill:shared-entry:start -->";
const end = "<!-- rill:shared-entry:end -->";
export function installPersonalPolicy(home: string, backups: string) {
  const entry = join(home, "AGENTS.md");
  const target = existsSync(entry) ? realpathSync(entry) : entry;
  const before = existsSync(target) ? readFileSync(target, "utf8") : "";
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
  const digest = createHash("sha256").update(before).digest("hex");
  const backup = join(backups, `AGENTS.${digest}.md`);
  if (after !== before) {
    if (!existsSync(backup)) atomicText(backup, before);
    atomicText(target, after);
  }
  return {
    target,
    backup,
    changed: after !== before,
    source: "shared-entry.md",
    nativeReload: "next session or native instruction reload",
  };
}
if (import.meta.main) {
  try {
    console.log(
      JSON.stringify(
        installPersonalPolicy(
          process.env.CODEX_HOME ?? join(homedir(), ".codex"),
          join(homedir(), ".local/state/rill/install-backups"),
        ),
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
