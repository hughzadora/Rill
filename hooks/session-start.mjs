import { closeSync, constants, existsSync, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { join } from "node:path";

const FACTORY_ENTRY = "# Rill Agent Entry\n";
const CONSUMER_ENTRY =
  "# Consumer Product Agent Entry\n\nThis is the consuming product, not the Rill factory source repository.";
// The canonical prefix with CRLF is the maximum input we ever need to inspect.
const ENTRY_BYTES = Buffer.byteLength(CONSUMER_ENTRY.replaceAll("\n", "\r\n"), "utf8");

function isRillProject(cwd) {
  const entryPath = join(cwd, "AGENTS.md");
  try {
    if (!lstatSync(entryPath).isFile()) return false;
    const fd = openSync(
      entryPath,
      constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0),
    );
    try {
      if (!fstatSync(fd).isFile()) return false;
      const buffer = Buffer.alloc(ENTRY_BYTES);
      const count = readSync(fd, buffer, 0, buffer.length, 0);
      const prefix = buffer.toString("utf8", 0, count).replaceAll("\r\n", "\n");
      return prefix.startsWith(FACTORY_ENTRY) || prefix.startsWith(CONSUMER_ENTRY);
    } finally {
      closeSync(fd);
    }
  } catch {
    return false;
  }
}

let input = "";
for await (const chunk of process.stdin) {
  input += chunk.toString();
  if (input.length > 65536) process.exit(2);
}

try {
  const payload = JSON.parse(input);
  if (payload?.hook_event_name !== "SessionStart" || typeof payload.cwd !== "string") {
    process.exit(0);
  }
  // Generic product documents are not Rill enrollment.
  if (!existsSync(join(payload.cwd, "PRD.md")) || !isRillProject(payload.cwd)) process.exit(0);

  const additionalContext =
    "Rill project detected. Read AGENTS.md as a router and only targeted FR/NFR lines from PRD.md. " +
    "Use live Git/GitHub Issue and exact-SHA tests for status; do not infer approval or green CI from a file.";
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } }) + "\n",
  );
} catch {
  process.exitCode = 2;
}
