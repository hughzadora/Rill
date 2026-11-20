/** Shared CLI contract: exit 1 = policy refusal; exit 2 = usage/environment failure. */
export class RillCommandError extends Error {
  constructor(
    message: string,
    readonly exitCode: 1 | 2,
    readonly category: "USAGE" | "POLICY" | "ENVIRONMENT" = exitCode === 1 ? "POLICY" : "ENVIRONMENT",
  ) {
    super(message);
  }
}
