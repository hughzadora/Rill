import { readFileSync } from "node:fs";
import { Ajv } from "ajv";

interface TestReport {
  success: boolean;
  numTotalTests: number;
  numFailedTests: number;
  numPendingTests: number;
  numTodoTests: number;
  testResults: {
    name: string;
    status: string;
    assertionResults: { fullName: string; status: string }[];
  }[];
}

const validate = new Ajv({ allErrors: true }).compile<TestReport>({
  type: "object",
  required: [
    "success",
    "numTotalTests",
    "numFailedTests",
    "numPendingTests",
    "numTodoTests",
    "testResults",
  ],
  properties: {
    success: { type: "boolean" },
    numTotalTests: { type: "integer", minimum: 0 },
    numFailedTests: { type: "integer", minimum: 0 },
    numPendingTests: { type: "integer", minimum: 0 },
    numTodoTests: { type: "integer", minimum: 0 },
    testResults: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "status", "assertionResults"],
        properties: {
          name: { type: "string" },
          status: { type: "string" },
          assertionResults: {
            type: "array",
            items: {
              type: "object",
              required: ["fullName", "status"],
              properties: {
                fullName: { type: "string" },
                status: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
});

export function checkTestReport(report: unknown) {
  if (!validate(report))
    throw new Error(
      `Invalid Vitest report: ${JSON.stringify(validate.errors)}`,
    );
  if (
    !report.success ||
    report.numTotalTests === 0 ||
    report.numFailedTests > 0 ||
    report.numPendingTests > 0 ||
    report.numTodoTests > 0
  )
    throw new Error(
      "Full-spec tests are failed, empty, skipped, or unfinished",
    );
  let count = 0;
  for (const file of report.testResults) {
    if (file.status !== "passed" || file.assertionResults.length === 0)
      throw new Error(`Incomplete test file: ${file.name} (${file.status})`);
    for (const assertion of file.assertionResults) {
      if (assertion.status !== "passed")
        throw new Error(
          `Incomplete test: ${file.name} > ${assertion.fullName} (${assertion.status})`,
        );
      count += 1;
    }
  }
  if (count !== report.numTotalTests)
    throw new Error(
      `Report test count mismatch: expected ${report.numTotalTests}, observed ${count}`,
    );
  return { files: report.testResults.length, tests: count };
}

if (import.meta.main) {
  try {
    const path = process.argv[2];
    if (!path)
      throw new Error(
        "Usage: check-test-report.ts <native-vitest-report.json>",
      );
    console.log(
      JSON.stringify(checkTestReport(JSON.parse(readFileSync(path, "utf8")))),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
