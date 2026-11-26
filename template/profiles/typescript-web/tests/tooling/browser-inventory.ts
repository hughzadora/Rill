import { relative, resolve } from "node:path";
import type { FullResult, Reporter, Suite } from "@playwright/test/reporter";

const expected = ["desktop-chromium", "mobile-chromium"]
  .flatMap((project) =>
    [
      "adds a reminder",
      "recovers from blank input using only the keyboard",
      "fits and reflows the form at the supported viewport",
      "passes axe in empty, invalid and populated states",
    ].map((title) => `${project}:tests/browser/reminders.spec.ts:${title}`),
  )
  .sort();

export default class BrowserInventory implements Reporter {
  private suite?: Suite;

  onBegin(_config: unknown, suite: Suite) {
    this.suite = suite;
  }

  async onEnd(result: FullResult) {
    if (result.status !== "passed") return;

    const tests = this.suite?.allTests() ?? [];
    const cwd = resolve(import.meta.dirname, "../..");
    const executed = tests
      .filter(
        ({ results, expectedStatus }) =>
          expectedStatus === "passed" && results.length === 1 && results[0]?.status === "passed",
      )
      .map(
        ({ parent, location, title }) =>
          `${parent.project()?.name}:${relative(cwd, location.file)}:${title}`,
      )
      .sort();
    if (tests.length === expected.length && JSON.stringify(executed) === JSON.stringify(expected)) {
      return;
    }
    console.error(
      `Browser inventory mismatch. Expected ${expected.join(", ")}. Passed ${executed.join(", ")}.`,
    );
    return { status: "failed" as const };
  }
}
