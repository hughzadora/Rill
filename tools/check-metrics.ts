import { execFileSync } from "node:child_process";
import { Ajv } from "ajv";

interface TokeiFile {
  name: string;
  stats: { code: number };
}

interface TokeiResult {
  TypeScript: { reports: TokeiFile[] };
}

const limit = 500;
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile<TokeiResult>({
  type: "object",
  required: ["TypeScript"],
  properties: {
    TypeScript: {
      type: "object",
      required: ["reports"],
      properties: {
        reports: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["name", "stats"],
            properties: {
              name: { type: "string", minLength: 1 },
              stats: {
                type: "object",
                required: ["code"],
                properties: {
                  code: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
                },
              },
            },
          },
        },
      },
    },
  },
});

export function checkMetrics(output: string): number {
  const report: unknown = JSON.parse(output);
  if (!validate(report)) {
    throw new Error(`Invalid tokei output: ${ajv.errorsText(validate.errors)}`);
  }

  const files = report.TypeScript.reports;
  const oversized = files.filter(({ stats }) => stats.code > limit);
  for (const file of oversized) {
    console.error(`${file.name}: ${file.stats.code} code LOC exceeds ${limit}`);
  }

  if (oversized.length > 0) {
    return 1;
  }

  console.log(`tokei: ${files.length} TypeScript files at or below ${limit} code LOC`);
  return 0;
}

if (import.meta.main) {
  process.exitCode = checkMetrics(
    execFileSync("tokei", ["--files", "--output", "json", "."], {
      encoding: "utf8",
    }),
  );
}
