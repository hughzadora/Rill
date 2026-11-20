import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
  if (!existsSync(join(payload.cwd, "PRD.md"))) process.exit(0);
  const agentsPath = join(payload.cwd, "AGENTS.md");
  if (!existsSync(agentsPath)) process.exit(0);
  const entry = readFileSync(agentsPath, "utf8");
  const isRillFactory = entry.startsWith("# Rill Agent Entry\n");
  const isRillConsumer =
    entry.startsWith("# Consumer Product Agent Entry\n") &&
    entry.includes("This is the consuming product, not the Rill factory source repository.");
  // A generic PRD is not Rill enrollment. Match only Rill's explicit agent entry.
  if (!isRillFactory && !isRillConsumer) process.exit(0);

  const additionalContext =
    "Rill project detected. Read AGENTS.md as a router and only targeted FR/NFR lines from PRD.md. " +
    "Use live Git/GitHub Issue and exact-SHA tests for status; do not infer approval or green CI from a file.";
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } }) + "\n",
  );
} catch {
  process.exitCode = 2;
}
