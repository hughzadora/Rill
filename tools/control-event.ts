import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import hookManifest from "../hooks/hooks.json" with { type: "json" };
import type { ControlEvent } from "./control-input.ts";
import {
  deliveryGuard,
  deliveryState,
  isDeliveryTool,
} from "./delivery-evidence.ts";
import { recoveryGuard } from "./recovery-state.ts";
import { repairGuard, repairState } from "./repair-evidence.ts";
import {
  effectiveStandardForProject,
  loadPackagedRuntime,
  type PackagedRuntime,
} from "./standard-runtime.ts";
import {
  activeTask,
  cachedTask,
  pendingRecords,
  projectContext,
  repositoryRevision,
  taskRecordView,
} from "./task-context.ts";

export type { ControlEvent } from "./control-input.ts";

export function enrolled(cwd: string) {
  let root: string;
  try {
    root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return false;
  }
  try {
    lstatSync(join(root, ".rill/project.json"));
    return true;
  } catch (error) {
    return !(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    );
  }
}

export function taskStatus(cwd: string, runtime?: PackagedRuntime) {
  if (!enrolled(cwd)) return { enrolled: false as const };
  const context = projectContext(cwd);
  const snapshot = cachedTask(context);
  const pending = pendingRecords(context);
  const recordView = taskRecordView(context);
  const records = recordView.records;
  const revision = repositoryRevision(context.root);
  const changes = execFileSync("git", ["status", "--porcelain"], {
    cwd: context.root,
    encoding: "utf8",
  });
  const { policyPath: _policyPath, ...effectiveStandard } =
    effectiveStandardForProject(context, runtime ?? loadPackagedRuntime());
  return {
    enrolled: true as const,
    repository: context.repository,
    taskUrl: activeTask(context),
    syncedAt: snapshot.syncedAt,
    remoteState: snapshot.issue.state,
    remoteUpdatedAt: snapshot.issue.updated_at,
    taskBody: snapshot.issue.body,
    records,
    recordProvenance: {
      ignoredCommentIds: recordView.ignoredCommentIds,
      trustedPublisherIds: recordView.trustedPublisherIds,
    },
    decisionSources: records
      .filter((record) => record.payload.executor === "rill-decision-source/v1")
      .map((record) => ({
        id: record.id,
        stage: record.payload.stage,
        subject: record.payload.subject,
        source: record.source,
        sourceSha256: record.payload.sourceSha256,
        semanticDecision: record.payload.semanticDecision,
      })),
    delivery: deliveryState(context),
    repair: repairState(context),
    pendingIds: pending.map((record) => record.id),
    ...revision,
    changes,
    effectiveStandard,
    cacheSource: context.recoveryRoot,
    remoteFreshness: "last-synchronized-snapshot" as const,
    coverage: {
      taskIdentityAndIntegrity: "implemented",
      nativeHistoryCoverage: "pending",
      designApprovalEvidence: "pending",
      automaticRepairAttempts: "pending",
      finalAcceptance: "pending",
    },
  };
}

export function blocked(event: ControlEvent, reason: string) {
  if (event.hook_event_name === "PreToolUse")
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    };
  if (
    ["SessionStart", "UserPromptSubmit", "PreCompact"].includes(
      event.hook_event_name,
    )
  )
    return { continue: false, stopReason: reason, systemMessage: reason };
  return { systemMessage: reason };
}

function sessionStartContext(
  preferences: string,
  policyPath: string | null,
  state: Extract<ReturnType<typeof taskStatus>, { enrolled: true }>,
) {
  const limit =
    hookManifest.hooks.SessionStart[0]?.hooks[0]?.additionalContextLimit;
  if (typeof limit !== "number" || !Number.isSafeInteger(limit) || limit <= 0)
    throw new Error("Native SessionStart context limit is not configured");
  const facts = {
    repository: state.repository,
    taskUrl: state.taskUrl,
    remoteState: state.remoteState,
    taskBody: state.taskBody as string | null,
    recordIds: state.records.map((record) => record.id),
    pendingIds: state.pendingIds,
    coverage: state.coverage,
    effectiveStandard: state.effectiveStandard,
    source: state.cacheSource,
  };
  const render = () => ({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext:
        preferences +
        "\n\nRecovered task summary, not a substitute for task source/history:\n" +
        JSON.stringify(facts) +
        "\nRead the full authoritative issue, local report and unsynchronized facts before dependent edits.",
    },
  });
  if (JSON.stringify(render()).length >= limit && policyPath)
    preferences =
      "Owner working agreements: read the installed policy at " + policyPath;
  if (JSON.stringify(render()).length >= limit) facts.taskBody = null;
  if (JSON.stringify(render()).length >= limit) {
    facts.recordIds = [];
    facts.pendingIds = [];
  }
  if (JSON.stringify(render()).length >= limit)
    throw new Error(
      "SessionStart summary exceeds the configured native context budget",
    );
  return render();
}

export function evaluateEvent(
  event: ControlEvent,
  runtime?: PackagedRuntime,
): Record<string, unknown> {
  try {
    if (
      event.hook_event_name === "PreToolUse" &&
      event.tool_name &&
      !/^(apply_patch|Edit|Write)$/.test(event.tool_name) &&
      !isDeliveryTool(event.tool_name)
    )
      return {};
    const activeRuntime = runtime ?? loadPackagedRuntime();
    const state = taskStatus(event.cwd, activeRuntime);
    if (!state.enrolled) return {};
    if (event.hook_event_name === "SessionStart") {
      const context = projectContext(event.cwd);
      const standard = effectiveStandardForProject(context, activeRuntime);
      const personalPolicy = new URL(
        "../skills/rill-preferences/references/personal-policy.md",
        import.meta.url,
      );
      const policyPath =
        context.schemaVersion === 1
          ? fileURLToPath(personalPolicy)
          : standard.policyPath;
      const preferences =
        context.schemaVersion === 1
          ? readFileSync(personalPolicy, "utf8")
          : standard.status === "ready" && standard.policyPath
            ? readFileSync(standard.policyPath, "utf8")
            : "Rill standard activation is blocked for pin " +
              (standard.version ?? "unknown") +
              "@" +
              (standard.digest ?? "unknown") +
              ". " +
              (standard.issues.join("; ") ||
                "The pinned standard is unavailable.") +
              " Dependent project work must wait; diagnostics and recovery remain available.";
      return sessionStartContext(preferences, policyPath, state);
    }
    if (
      event.hook_event_name === "PreToolUse" &&
      state.remoteState === "closed"
    )
      return blocked(
        event,
        "The bound task is closed. Reconcile actual authorized scope before executing task tools.",
      );
    if (
      event.hook_event_name === "PreToolUse" &&
      event.tool_name &&
      state.effectiveStandard.dependentActivation === "blocked" &&
      (/^(apply_patch|Edit|Write)$/.test(event.tool_name) ||
        isDeliveryTool(event.tool_name))
    )
      return blocked(
        event,
        `Pinned Rill standard ${state.effectiveStandard.version ?? "unknown"}@${state.effectiveStandard.digest ?? "unknown"} is unavailable. Supported project edits and delivery are blocked; diagnostics and recovery remain available. ${state.effectiveStandard.issues.join("; ")}`,
      );
    if (event.hook_event_name === "PreToolUse") {
      const recoveryReason = recoveryGuard(
        projectContext(event.cwd),
        event.session_id,
      );
      if (recoveryReason) return blocked(event, recoveryReason);
      const reason = repairGuard(projectContext(event.cwd), event.tool_name);
      if (reason) return blocked(event, reason);
      const deliveryReason = deliveryGuard(
        projectContext(event.cwd),
        event.tool_name,
        event.tool_input,
      );
      if (deliveryReason) return blocked(event, deliveryReason);
    }
    if (
      event.hook_event_name === "PostToolUse" &&
      /repair_(check|diagnose|interpret)$/.test(event.tool_name ?? "")
    )
      return {
        systemMessage: `Rill actual repair evidence state: ${JSON.stringify(state.repair)}. Inspect the recorded output before judging cause or completion.`,
      };
    if (event.hook_event_name === "UserPromptSubmit")
      return {
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: `Rill preferences apply. Engineering methods come from installed Matt Pocock skills. Raw ideas use brainstorming, grill-with-docs methods and writing-for-agents. Bound task: ${state.taskUrl}. Coverage: ${JSON.stringify(state.coverage)}. ${state.effectiveStandard.dependentActivation === "blocked" ? `Rill dependent project activation is blocked for standard ${state.effectiveStandard.version ?? "unknown"}@${state.effectiveStandard.digest ?? "unknown"}; diagnostics and recovery remain available. ${state.effectiveStandard.issues.join("; ")}` : `Effective standard: ${JSON.stringify(state.effectiveStandard)}.`}`,
        },
      };
    if (event.hook_event_name === "Stop")
      return {
        systemMessage: `Rill task remains subject to acceptance at ${state.taskUrl}; this hook has not verified final acceptance. Pending synchronization: ${state.pendingIds.length}.`,
      };
    return {};
  } catch (error) {
    return blocked(
      event,
      `Rill task precondition unavailable: ${error instanceof Error ? error.message : String(error)}. Recover or synchronize the enrolled task through the structured task tools before continuing dependent work.`,
    );
  }
}
