import { match } from "ts-pattern";
import { err, ok, Result } from "neverthrow";
import { z } from "zod";
import { env, workflowLimits } from "./env";

export { workflowLimits };

export const workflowConfigSchema = z.object({
  maxSteps: z.number().int().nonnegative().max(workflowLimits.maxSteps),
  timeoutMs: z.number().int().nonnegative().max(workflowLimits.timeoutMs),
  maxTokenBudget: z.number().int().nonnegative().max(workflowLimits.maxTokenBudget),
});

export type WorkflowConfig = z.infer<typeof workflowConfigSchema>;
export type WorkflowStatus = "idle" | "running" | "completed" | "cancelled" | "failed";

export interface WorkflowState {
  status: WorkflowStatus;
  steps: number;
  tokens: number;
  elapsedMs: number;
}

export type WorkflowEvent =
  | { type: "start" }
  | { type: "step"; tokens?: number; elapsedMs?: number }
  | { type: "finish" }
  | { type: "cancel" };

export function createWorkflowConfig(overrides: Partial<WorkflowConfig> = {}): WorkflowConfig {
  return workflowConfigSchema.parse({
    maxSteps: overrides.maxSteps ?? env.RILL_MAX_STEPS,
    timeoutMs: overrides.timeoutMs ?? env.RILL_TIMEOUT_MS,
    maxTokenBudget: overrides.maxTokenBudget ?? env.RILL_MAX_TOKEN_BUDGET,
  });
}

function clampTokenDelta(tokens?: number): number {
  return tokens === undefined || !Number.isFinite(tokens) ? 0 : Math.max(0, Math.trunc(tokens));
}

function clampElapsedMs(current: number, elapsedMs?: number): number {
  return elapsedMs === undefined || !Number.isFinite(elapsedMs)
    ? current
    : Math.max(current, Math.trunc(elapsedMs));
}

function checkLimitsExceeded(
  state: WorkflowState,
  config: WorkflowConfig,
  tokenDelta: number,
  nextElapsedMs: number,
): boolean {
  return (
    nextElapsedMs > config.timeoutMs ||
    state.steps >= config.maxSteps ||
    state.tokens + tokenDelta > config.maxTokenBudget
  );
}

export type ReducerError =
  | { type: "INVALID_STATE"; message: string }
  | { type: "LIMIT_EXCEEDED"; limit: "timeout" | "steps" | "tokens" };

export function workflowReducer(
  state: WorkflowState,
  event: WorkflowEvent,
  config: WorkflowConfig,
): Result<WorkflowState, ReducerError> {
  if (state.status === "completed" || state.status === "cancelled" || state.status === "failed") {
    return ok(state);
  }

  return match(event)
    .with({ type: "start" }, () =>
      state.status === "idle" ? ok({ ...state, status: "running" } as const) : ok(state),
    )
    .with({ type: "step" }, ({ tokens, elapsedMs }) => {
      if (state.status !== "running") return ok(state);
      const tokenDelta = clampTokenDelta(tokens);
      const nextElapsedMs = clampElapsedMs(state.elapsedMs, elapsedMs);

      if (checkLimitsExceeded(state, config, tokenDelta, nextElapsedMs)) {
        const limit: "timeout" | "steps" | "tokens" =
          nextElapsedMs > config.timeoutMs
            ? "timeout"
            : state.steps >= config.maxSteps
              ? "steps"
              : "tokens";
        return err({ type: "LIMIT_EXCEEDED", limit } as const);
      }

      return ok({
        status: "running" as const,
        steps: state.steps + 1,
        tokens: state.tokens + tokenDelta,
        elapsedMs: nextElapsedMs,
      });
    })
    .with({ type: "finish" }, () =>
      state.status === "running" ? ok({ ...state, status: "completed" } as const) : ok(state),
    )
    .with({ type: "cancel" }, () => ok({ ...state, status: "cancelled" } as const))
    .exhaustive();
}
