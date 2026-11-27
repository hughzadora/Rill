/// <reference types="node" />

const expectedJobs = ["artifact", "qualification", "verify", "scan-secrets"];

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasSuccessfulResult(job: unknown): boolean {
  if (!isPlainObject(job)) return false;
  for (const [key, value] of Object.entries(job)) {
    if (key === "result" && isString(value) && value === "success") {
      return true;
    }
  }
  return false;
}

export function validateRequiredResults(input: string): string | null {
  let results: unknown;
  try {
    results = JSON.parse(input);
  } catch {
    return "Required job results are not valid JSON";
  }

  if (!isPlainObject(results)) {
    return "Required job set does not match the reviewed workflow";
  }

  const actualJobs = Object.keys(results).sort();
  if (JSON.stringify(actualJobs) !== JSON.stringify(expectedJobs)) {
    return "Required job set does not match the reviewed workflow";
  }

  const failures = expectedJobs.filter((name) => !hasSuccessfulResult(results[name]));
  if (failures.length > 0) {
    return `Required jobs did not succeed: ${failures.join(", ")}`;
  }

  return null;
}

const input = typeof process.env.REQUIRED_RESULTS === "string" ? process.env.REQUIRED_RESULTS : "";
const failure = validateRequiredResults(input);
if (failure) {
  console.error(failure);
  process.exitCode = 1;
}
