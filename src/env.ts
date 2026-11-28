import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/** Hard ceilings applied to every workflow run. @public */
export const workflowLimits = {
  maxSteps: 10_000,
  timeoutMs: 3_600_000,
  maxTokenBudget: 1_000_000,
} as const;

/** Validated environment variables. @public */
export const env = createEnv({
  server: {
    RILL_MAX_STEPS: z.coerce
      .number()
      .int()
      .nonnegative()
      .max(workflowLimits.maxSteps)
      .default(workflowLimits.maxSteps),
    RILL_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .nonnegative()
      .max(workflowLimits.timeoutMs)
      .default(workflowLimits.timeoutMs),
    RILL_MAX_TOKEN_BUDGET: z.coerce
      .number()
      .int()
      .nonnegative()
      .max(workflowLimits.maxTokenBudget)
      .default(workflowLimits.maxTokenBudget),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

/** Validated environment shape. @public */
export type Env = typeof env;
