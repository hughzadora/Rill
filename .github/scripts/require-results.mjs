const expectedJobs = ["artifact", "qualification", "scan-secrets", "verify"];

function validateRequiredResults(input) {
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

  const failures = expectedJobs.filter((name) => {
    const job = results[name];
    return typeof job !== "object" || job === null || job.result !== "success";
  });
  if (failures.length > 0) {
    return `Required jobs did not succeed: ${failures.join(", ")}`;
  }

  return null;
}

const input = process.env.REQUIRED_RESULTS ?? "";
const failure = validateRequiredResults(input);
if (failure) {
  console.error(failure);
  process.exitCode = 1;
}
