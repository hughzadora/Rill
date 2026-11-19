#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const configSchema = z.object({
  schemaVersion: z.literal(1),
  purpose: z.string().min(1),
  sourcePaths: z.array(z.string().min(1)).min(1),
  optionalSourcePaths: z.array(z.string().min(1)).default([]),
  extensions: z.array(z.string().startsWith(".")).min(1),
  limits: z.object({
    maximumCyclomaticComplexity: z.number().int().positive(),
    maximumFunctionLines: z.number().int().positive(),
    maximumParameters: z.number().int().positive(),
    maximumCodeLinesPerFile: z.number().int().positive(),
  }),
});

type Config = z.infer<typeof configSchema>;
interface MeasuredFile {
  path: string;
  codeLines: number;
}

function git(root: string, args: string[]) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
}

function gitListedSources(root: string, patterns: string[], config: Config) {
  const output = execFileSync("git", [
    "-C",
    root,
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    ...patterns,
  ]).toString("utf8");
  const files = output
    .split("\0")
    .filter(Boolean)
    .filter(
      (file) =>
        config.extensions.includes(extname(file)) &&
        existsSync(resolve(root, file)),
    );
  return [...new Set(files)].sort();
}

function gitSources(root: string, config: Config) {
  return gitListedSources(
    root,
    [...config.sourcePaths, ...config.optionalSourcePaths],
    config,
  );
}

function timedCommand(root: string, name: string, args: string[]) {
  const start = performance.now();
  const result = spawnSync(name, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    argv: [name, ...args],
    exitCode: result.status,
    error: result.error?.message ?? null,
    durationMs: Math.round(performance.now() - start),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function tokeiFiles(raw: string): MeasuredFile[] {
  const report = JSON.parse(raw) as Record<string, unknown>;
  const files: MeasuredFile[] = [];
  for (const [lang, content] of Object.entries(report)) {
    if (lang === "Total" || !content || typeof content !== "object") continue;
    const data = content as {
      reports?: Array<{ name: string; stats: { code: number } }>;
    };
    for (const file of data.reports ?? []) {
      if (typeof file.name !== "string" || !Number.isInteger(file.stats?.code))
        throw new Error("Tokei returned invalid file counts");
      files.push({
        path: file.name.replace(/^\.\//, ""),
        codeLines: file.stats.code,
      });
    }
  }
  return files;
}

function coverage(expected: string[], measured: MeasuredFile[]) {
  const names = measured.map((file) => file.path);
  const unique = new Set(names);
  return {
    missing: expected.filter((name) => !unique.has(name)),
    unexpected: names.filter((name) => !expected.includes(name)),
    duplicates: names.filter((name, index) => names.indexOf(name) !== index),
  };
}

function projectRoot(path: string) {
  const root = realpathSync(path);
  const gitRoot = realpathSync(
    git(root, ["rev-parse", "--show-toplevel"]).trim(),
  );
  const location = relative(gitRoot, root);
  const insideRepository =
    location &&
    location !== ".." &&
    !location.startsWith(`..${sep}`) &&
    !isAbsolute(location);
  if (
    root !== gitRoot &&
    !(insideRepository && existsSync(resolve(root, "package.json")))
  )
    throw new Error("Expected a Git root or a workspace package root");
  return root;
}

function measuredInputs(root: string, config: Config) {
  const expected = gitSources(root, config);
  const allSources = gitListedSources(root, ["*.ts", "*.tsx"], config);
  const outsideRoots = allSources.filter((file) => !expected.includes(file));
  if (expected.length === 0)
    throw new Error("No tracked/untracked source files were found");
  const sources = [...config.sourcePaths, ...config.optionalSourcePaths];
  const checkedPaths = sources.filter((path) =>
    existsSync(resolve(root, path)),
  );
  const missingRoots = config.sourcePaths.filter(
    (path) => !checkedPaths.includes(path),
  );
  const tokei = timedCommand(root, "tokei", [
    "--files",
    "--output",
    "json",
    ...checkedPaths,
  ]);
  if (tokei.exitCode !== 0)
    throw new Error(`Tokei did not run: ${tokei.stderr}`);
  const measured = tokeiFiles(tokei.stdout).filter((file) =>
    config.extensions.includes(extname(file.path)),
  );
  return {
    expected,
    measured,
    tokei,
    checkedPaths,
    missingRoots,
    outsideRoots,
  };
}

function scanComplexity(root: string, config: Config, checkedPaths: string[]) {
  const scan = timedCommand(root, "lizard", [
    "-l",
    "typescript",
    "-l",
    "tsx",
    "-C",
    String(config.limits.maximumCyclomaticComplexity),
    "-L",
    String(config.limits.maximumFunctionLines),
    "-a",
    String(config.limits.maximumParameters),
    ...checkedPaths,
  ]);
  const parsed = /(\d+) file(?:s)? analyzed\./.exec(scan.stdout);
  const analyzedFiles = parsed ? Number(parsed[1]) : null;
  const warnings = scan.stdout.includes("!!!! Warnings")
    ? scan.stdout
        .split("!!!! Warnings")
        .slice(1)
        .join("!!!! Warnings")
        .split("Total nloc")[0]
        .trim()
    : null;
  return { scan, analyzedFiles, warnings };
}

function scanReceipt(
  scan: ReturnType<typeof timedCommand>,
  warnings?: string | null,
) {
  return {
    command: scan.argv,
    exitCode: scan.exitCode,
    error: scan.error,
    durationMs: scan.durationMs,
    outputSha256: createHash("sha256")
      .update(scan.stdout + scan.stderr)
      .digest("hex"),
    ...(warnings === undefined ? {} : { warnings }),
  };
}

export function measureProject(rootArgument: string, config: Config) {
  const root = projectRoot(rootArgument);
  const inputs = measuredInputs(root, config);
  const fileCoverage = coverage(inputs.expected, inputs.measured);
  const complexity = scanComplexity(root, config, inputs.checkedPaths);
  const oversize = inputs.measured.filter(
    (file) => file.codeLines > config.limits.maximumCodeLinesPerFile,
  );
  const passed =
    inputs.outsideRoots.length === 0 &&
    inputs.missingRoots.length === 0 &&
    fileCoverage.missing.length === 0 &&
    fileCoverage.unexpected.length === 0 &&
    fileCoverage.duplicates.length === 0 &&
    complexity.scan.exitCode === 0 &&
    complexity.analyzedFiles === inputs.expected.length &&
    oversize.length === 0;
  return {
    schemaVersion: 1 as const,
    root,
    revision: git(root, ["rev-parse", "HEAD"]).trim(),
    worktreeStatus: git(root, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]),
    configSha256: createHash("sha256")
      .update(JSON.stringify(config))
      .digest("hex"),
    filesExpected: inputs.expected.length,
    filesMeasured: inputs.measured.length,
    lizardAnalyzed: complexity.analyzedFiles,
    missingRoots: inputs.missingRoots,
    outsideRoots: inputs.outsideRoots,
    coverage: fileCoverage,
    oversize,
    lizard: scanReceipt(complexity.scan, complexity.warnings),
    tokei: scanReceipt(inputs.tokei),
    passed,
  };
}

function main() {
  const args = process.argv.slice(2);
  if (
    args[0] !== "--root" ||
    !args[1] ||
    (args.length !== 2 && args.length !== 4) ||
    (args.length === 4 && args[2] !== "--profile")
  )
    throw new Error(
      "Usage: quality-metrics.ts --root <project> [--profile <name>]",
    );
  const name = args[3] ?? "rill-typescript";
  if (!/^[a-z][a-z0-9-]*$/.test(name))
    throw new Error("Invalid metrics profile name");
  const configPath = fileURLToPath(
    new URL(`../profiles/${name}.json`, import.meta.url),
  );
  const config = configSchema.parse(
    JSON.parse(readFileSync(configPath, "utf8")),
  );
  const result = measureProject(args[1], config);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.passed) process.exitCode = 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
