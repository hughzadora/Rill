import { describe, expect, test } from "vitest";
import { checkTestReport } from "../tools/check-test-report.ts";

const complete = () => ({
  success: true,
  numTotalTests: 1,
  numFailedTests: 0,
  numPendingTests: 0,
  numTodoTests: 0,
  testResults: [
    {
      name: "example.test.ts",
      status: "passed",
      assertionResults: [{ fullName: "original behavior", status: "passed" }],
    },
  ],
});
describe("full-spec report integrity", () => {
  test("accepts a complete native result", () => {
    expect(checkTestReport(complete())).toEqual({ files: 1, tests: 1 });
  });
  test("rejects a missing or malformed result", () => {
    expect(() => checkTestReport({})).toThrow("Invalid Vitest report");
  });
  test("rejects an empty green report", () => {
    expect(() =>
      checkTestReport({ ...complete(), numTotalTests: 0, testResults: [] }),
    ).toThrow("empty");
  });
  test("rejects skipped, todo, and failed totals", () => {
    for (const field of ["numFailedTests", "numPendingTests", "numTodoTests"])
      expect(() => checkTestReport({ ...complete(), [field]: 1 })).toThrow(
        "unfinished",
      );
  });
  test("rejects hidden skips and inconsistent summary counts", () => {
    const report = complete();
    report.testResults[0]?.assertionResults.splice(0, 1, {
      fullName: "omitted behavior",
      status: "pending",
    });
    expect(() => checkTestReport(report)).toThrow("omitted behavior");
    expect(() => checkTestReport({ ...complete(), numTotalTests: 2 })).toThrow(
      "count mismatch",
    );
  });
});
