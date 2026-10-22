import { execFileSync } from "node:child_process";

interface TokeiFile {
  name: string;
  stats: { code: number };
}

interface TokeiResult {
  TypeScript?: { reports: TokeiFile[] };
}

const limit = 500;
const output = execFileSync("tokei", ["--files", "--output", "json", "."], {
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});
const report = JSON.parse(output) as TokeiResult;
const files = report.TypeScript?.reports ?? [];

if (files.length === 0) {
  throw new Error("tokei found no TypeScript files; cannot establish the LOC gate");
}

const oversized = files.filter(({ stats }) => stats.code > limit);
for (const file of oversized) {
  console.error(`${file.name}: ${file.stats.code} code LOC exceeds ${limit}`);
}

if (oversized.length > 0) {
  process.exitCode = 1;
} else {
  console.log(`tokei: ${files.length} TypeScript files at or below ${limit} code LOC`);
}
