import { pathToFileURL } from "node:url";

const expectedJobs = ["artifact", "qualification", "verify"];

export function validateRequiredResults(input) {
  let results;
  try {
    results = JSON.parse(input);
  } catch {
    return "Required job results are not valid JSON";
  }

  if (typeof results !== "object" || results === null || Array.isArray(results)) {
    return "Required job set does not match the reviewed workflow";
  }

  const actualJobs = Object.keys(results).sort();
  if (JSON.stringify(actualJobs) !== JSON.stringify(expectedJobs)) {
    return "Required job set does not match the reviewed workflow";
  }

  const failures = expectedJobs.filter(
    (name) =>
      typeof results[name] !== "object" ||
      results[name] === null ||
      results[name].result !== "success",
  );
  if (failures.length > 0) {
    return `Required jobs did not succeed: ${failures.join(", ")}`;
  }

  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const failure = validateRequiredResults(process.env.REQUIRED_RESULTS ?? "");
  if (failure) {
    console.error(failure);
    process.exitCode = 1;
  }
}
