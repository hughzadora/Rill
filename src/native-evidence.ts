/**
 * Classify machine-observed Codex events only. Model-written success claims,
 * empty waits and absent warnings are not evidence of native execution.
 *
 * This does not replace Codex session or trust handling.
 */
export type Observation = "OBSERVED" | "NOT_VERIFIED";
export type ProjectConfigObservation = "DISABLED" | "UNKNOWN";

interface CodexEvent {
  type?: unknown;
  item?: {
    type?: unknown;
    server?: unknown;
    tool?: unknown;
    arguments?: unknown;
    status?: unknown;
    error?: unknown;
    receiver_thread_ids?: unknown;
  };
}

export interface NativeEvidence {
  session: "COMPLETED" | "NOT_VERIFIED";
  skillRead: Observation;
  delegation: Observation;
  projectConfig: ProjectConfigObservation;
  customRoles: "NOT_VERIFIED";
  hookInvocation: "NOT_VERIFIED";
}

export function verifyNativeEvidence(jsonl: string, stderr: string): NativeEvidence {
  const events: CodexEvent[] = [];
  for (const [index, line] of jsonl.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Not an event object");
      }
      events.push(parsed as CodexEvent);
    } catch {
      throw new Error(`Invalid Codex JSONL at line ${index + 1}`);
    }
  }

  const complete = events.some((event) => event.type === "turn.completed");
  const hasFailed = events.some((event) => event.type === "turn.failed");
  const readSkill = events.some((event) => {
    const item = event.item;
    if (
      event.type !== "item.completed" ||
      item?.type !== "mcp_tool_call" ||
      item.status !== "completed" ||
      item.error
    )
      return false;
    const args = item.arguments;
    const filePath =
      typeof args === "object" && args !== null && "path" in args
        ? (args as { path?: unknown }).path
        : null;
    return typeof filePath === "string" && /\/skills\/rill-discovery\/SKILL\.md$/.test(filePath);
  });

  // "wait" without any receiver threads does not prove delegation.
  const spawn = events.some((event) => {
    const item = event.item;
    return (
      event.type === "item.completed" &&
      item?.type === "collab_tool_call" &&
      item.tool === "spawn_agent" &&
      item.status === "completed" &&
      Array.isArray(item.receiver_thread_ids) &&
      item.receiver_thread_ids.some((id: unknown) => typeof id === "string" && id.length > 0)
    );
  });

  const blocked = stderr.includes("Untrusted project-local configuration is disabled");
  return {
    session: complete && !hasFailed ? "COMPLETED" : "NOT_VERIFIED",
    skillRead: readSkill ? "OBSERVED" : "NOT_VERIFIED",
    delegation: spawn ? "OBSERVED" : "NOT_VERIFIED",
    projectConfig: blocked ? "DISABLED" : "UNKNOWN",
    customRoles: "NOT_VERIFIED",
    hookInvocation: "NOT_VERIFIED",
  };
}
