import { Glob } from "bun";
import { join } from "node:path";
import { createWorkflowConfig, workflowReducer } from "../src/workflow";
import type { WorkflowEvent, WorkflowState } from "../src/workflow";

interface EvalStep {
  name: string;
  event: WorkflowEvent;
  expect?: Partial<WorkflowState>;
}

interface EvalCase {
  id: string;
  description: string;
  config: { maxSteps: number; timeoutMs: number; maxTokenBudget: number };
  steps: EvalStep[];
}

const directory = join(import.meta.dir, "cases");

async function loadCases(): Promise<EvalCase[]> {
  const glob = new Glob("*.json");
  const cases: EvalCase[] = [];
  for await (const entry of glob.scan(directory)) {
    const parsed: unknown = await Bun.file(join(directory, entry)).json();
    if (!isEvalCase(parsed)) throw new Error(`Invalid eval case: ${entry}`);
    cases.push(parsed);
  }
  return cases.sort((left, right) => left.id.localeCompare(right.id));
}

function isEvalCase(candidate: unknown): candidate is EvalCase {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value: Record<string, unknown> = candidate;
  const steps: unknown = value.steps;
  return (
    typeof value.id === "string" &&
    typeof value.description === "string" &&
    typeof value.config === "object" &&
    value.config !== null &&
    Array.isArray(steps)
  );
}

function initialState(): WorkflowState {
  return { status: "idle", steps: 0, tokens: 0, elapsedMs: 0 };
}

function describeMismatch(
  caseId: string,
  stepName: string,
  expected: Partial<WorkflowState>,
  actual: WorkflowState,
): string {
  const differences = Object.entries(expected).flatMap(([key, value]) =>
    isWorkflowKey(key) && actual[key] !== value
      ? [`${key}: expected ${String(value)}, received ${String(actual[key])}`]
      : [],
  );
  return `${caseId} / ${stepName}: ${differences.join("; ")}`;
}

const workflowKeys = ["status", "steps", "tokens", "elapsedMs"] as const;
type WorkflowKey = (typeof workflowKeys)[number];

function isWorkflowKey(key: string): key is WorkflowKey {
  return (workflowKeys as readonly string[]).includes(key);
}
const failures: string[] = [];
const cases = await loadCases();

for (const evalCase of cases) {
  let state = initialState();
  const config = createWorkflowConfig(evalCase.config);
  for (const step of evalCase.steps) {
    state = workflowReducer(state, step.event, config);
    if (step.expect === undefined) continue;
    const mismatch = describeMismatch(evalCase.id, step.name, step.expect, state);
    if (mismatch.includes("expected")) failures.push(mismatch);
  }
  console.log(`${failures.length === 0 ? "pass" : "fail"} ${evalCase.id}: ${evalCase.description}`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(`\n${failures.length} eval failure(s)`);
  process.exit(1);
}

console.log(`\n${cases.length} eval cases passed`);
