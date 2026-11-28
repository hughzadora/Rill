import { describe, expect, test } from "bun:test";
import * as fc from "fast-check";
import { Result, ok } from "neverthrow";
import {
  createWorkflowConfig,
  workflowLimits,
  workflowReducer,
  type WorkflowConfig,
  type WorkflowEvent,
  type WorkflowState,
  type WorkflowStatus,
  type ReducerError,
} from "../../../src/workflow";

const initialState: WorkflowState = {
  status: "idle",
  steps: 0,
  tokens: 0,
  elapsedMs: 0,
};

const configArbitrary: fc.Arbitrary<WorkflowConfig> = fc
  .record({
    maxSteps: fc.integer({ min: 0, max: workflowLimits.maxSteps }),
    timeoutMs: fc.integer({ min: 0, max: workflowLimits.timeoutMs }),
    maxTokenBudget: fc.integer({ min: 0, max: workflowLimits.maxTokenBudget }),
  })
  .map((config) => createWorkflowConfig(config));

const stepEventArbitrary: fc.Arbitrary<WorkflowEvent> = fc.oneof(
  fc.constant<WorkflowEvent>({ type: "step" }),
  fc.integer({ min: 0, max: 25 }).map((tokens): WorkflowEvent => ({ type: "step", tokens })),
  fc
    .integer({ min: 0, max: workflowLimits.timeoutMs + 1 })
    .map((elapsedMs): WorkflowEvent => ({ type: "step", elapsedMs })),
);

const eventArbitrary: fc.Arbitrary<WorkflowEvent> = fc.oneof(
  fc.constant<WorkflowEvent>({ type: "start" }),
  fc.constant<WorkflowEvent>({ type: "finish" }),
  fc.constant<WorkflowEvent>({ type: "cancel" }),
  stepEventArbitrary,
);

function unwrapState(result: Result<WorkflowState, ReducerError>): WorkflowState {
  if (result.isOk()) return result.value;
  throw new Error(`Expected Ok, got Err: ${JSON.stringify(result.error)}`);
}

function isLimitExceededError(
  error: ReducerError,
): error is { type: "LIMIT_EXCEEDED"; limit: "timeout" | "steps" | "tokens" } {
  return error.type === "LIMIT_EXCEEDED";
}

describe("workflow reducer invariants", () => {
  test("random event ordering never breaches step or token limits", () => {
    fc.assert(
      fc.property(
        configArbitrary,
        fc.array(eventArbitrary, { maxLength: 40 }),
        (config, events) => {
          let state: WorkflowState = initialState;
          for (const event of events) {
            const result = workflowReducer(state, event, config);
            state = unwrapState(result);
            expect(Number.isInteger(state.steps)).toBe(true);
            expect(Number.isInteger(state.tokens)).toBe(true);
            expect(state.steps).toBeGreaterThanOrEqual(0);
            expect(state.steps).toBeLessThanOrEqual(config.maxSteps);
            expect(state.tokens).toBeGreaterThanOrEqual(0);
            expect(state.tokens).toBeLessThanOrEqual(config.maxTokenBudget);
          }
        },
      ),
      { numRuns: 250 },
    );
  });

  test("terminal states are stable under later random events", () => {
    const terminalStatuses: WorkflowStatus[] = ["completed", "cancelled", "failed"];
    fc.assert(
      fc.property(
        configArbitrary,
        fc.constantFrom(...terminalStatuses),
        fc.array(eventArbitrary, { maxLength: 20 }),
        (config, status, events) => {
          const terminal: WorkflowState = {
            status,
            steps: 0,
            tokens: 0,
            elapsedMs: 0,
          };
          const afterResult = events.reduce(
            (currentResult: Result<WorkflowState, ReducerError>, event: WorkflowEvent) => {
              const current = unwrapState(currentResult);
              return workflowReducer(current, event, config);
            },
            ok(terminal) as Result<WorkflowState, ReducerError>,
          );
          const after = unwrapState(afterResult);
          expect(after).toEqual(terminal);
        },
      ),
      { numRuns: 200 },
    );
  });

  test("finish is rejected unless the workflow is running", () => {
    const nonRunningStatuses: WorkflowStatus[] = ["idle", "completed", "cancelled", "failed"];
    fc.assert(
      fc.property(configArbitrary, fc.constantFrom(...nonRunningStatuses), (config, status) => {
        const state: WorkflowState = {
          status,
          steps: 0,
          tokens: 0,
          elapsedMs: 0,
        };
        const result = workflowReducer(state, { type: "finish" }, config);
        const after = unwrapState(result);
        expect(after).toEqual(state);
      }),
      { numRuns: 100 },
    );
  });

  test("exceeding either budget fails without accounting over-limit work", () => {
    const config = createWorkflowConfig({ maxSteps: 1, timeoutMs: 1_000, maxTokenBudget: 5 });
    const running: WorkflowState = {
      status: "running",
      steps: 0,
      tokens: 0,
      elapsedMs: 0,
    };
    const overTokensResult = workflowReducer(running, { type: "step", tokens: 6 }, config);
    expect(overTokensResult.isErr()).toBe(true);
    if (overTokensResult.isErr() && isLimitExceededError(overTokensResult.error)) {
      expect(overTokensResult.error.limit).toBe("tokens");
    }

    const withinBudgetResult = workflowReducer(running, { type: "step", tokens: 5 }, config);
    const withinBudget = unwrapState(withinBudgetResult);
    expect(withinBudget.steps).toBe(1);
    expect(withinBudget.tokens).toBe(5);

    const overStepsResult = workflowReducer(withinBudget, { type: "step" }, config);
    expect(overStepsResult.isErr()).toBe(true);
    if (overStepsResult.isErr() && isLimitExceededError(overStepsResult.error)) {
      expect(overStepsResult.error.limit).toBe("steps");
    }
  });

  test("a step beyond the timeout fails the workflow and ignores later steps", () => {
    const config = createWorkflowConfig({ maxSteps: 10, timeoutMs: 100, maxTokenBudget: 100 });
    const running: WorkflowState = {
      status: "running",
      steps: 0,
      tokens: 0,
      elapsedMs: 0,
    };
    const failedResult = workflowReducer(
      running,
      { type: "step", tokens: 1, elapsedMs: 101 },
      config,
    );
    expect(failedResult.isErr()).toBe(true);
    if (failedResult.isErr() && isLimitExceededError(failedResult.error)) {
      expect(failedResult.error.limit).toBe("timeout");
    }
    const failed: WorkflowState = {
      status: "failed",
      steps: 0,
      tokens: 0,
      elapsedMs: 101,
    };
    const afterResult = workflowReducer(failed, { type: "step", tokens: 1 }, config);
    const after = unwrapState(afterResult);
    expect(after).toEqual(failed);
  });

  test("finish completes a running workflow", () => {
    const config = createWorkflowConfig();
    const running: WorkflowState = {
      status: "running",
      steps: 0,
      tokens: 0,
      elapsedMs: 0,
    };
    const result = workflowReducer(running, { type: "finish" }, config);
    expect(result.isOk()).toBe(true);
    const after = unwrapState(result);
    expect(after.status).toBe("completed");
  });
});
