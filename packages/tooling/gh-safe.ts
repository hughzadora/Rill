import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const REDACTED_PROJECT = "<PROJECT_ROOT>";
const REDACTED_HOME = "<HOME_DIR>";
const REDACTED_IP = "<INTERNAL_IP>";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_EVENTS = 3;
const RATE_LIMIT_PATH = join(process.cwd(), ".turbo", "gh-rate-limit.json");

type RateLimitEntries = Record<string, number[]>;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactPaths(content: string): string {
  let result = content;
  const projectRoot = process.cwd();
  const homeDirectory = homedir();

  if (projectRoot) {
    result = result.replace(new RegExp(escapeRegExp(projectRoot), "g"), REDACTED_PROJECT);
  }

  if (homeDirectory) {
    result = result.replace(new RegExp(escapeRegExp(homeDirectory), "g"), REDACTED_HOME);
  }

  result = result.replace(/(?:\/Users\/|\/home\/)[^\s"'<>]+/g, REDACTED_HOME);
  result = result.replace(/[A-Za-z]:\\Users\\[^\s"'<>]+/g, REDACTED_HOME);
  return result;
}

function redactInternalIps(content: string): string {
  return content.replace(
    /(?<![\d.])(?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))(?:\.\d{1,3}){2}(?![\d.])/g,
    REDACTED_IP,
  );
}

function sanitize(content: string): string {
  return redactInternalIps(redactPaths(content));
}

function hasFinding(report: string): boolean {
  const trimmed = report.trim();
  if (trimmed.length === 0) return false;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (typeof parsed === "object" && parsed !== null) {
      const record: Record<string, unknown> = { ...parsed };
      return [record.findings, record.finding, record.Finding].some(
        (findings) => Array.isArray(findings) && findings.length > 0,
      );
    }
  } catch {
    // Gitleaks may emit a text report, so inspect its finding marker below.
  }

  return /\bfinding\b/i.test(report);
}

function checkGitleaks(content: string): boolean {
  const result = spawnSync(
    "gitleaks",
    ["stdin", "--no-banner", "--redact", "--config", ".gitleaks.toml"],
    { input: content, encoding: "utf8" },
  );

  if (result.error) {
    process.stderr.write(`gh-safe: unable to run gitleaks: ${result.error.message}\n`);
    return false;
  }

  if (result.status !== 0 || hasFinding(`${result.stdout}\n${result.stderr}`)) {
    process.stderr.write("gh-safe: secret scan failed; content blocked\n");
    return false;
  }

  return true;
}

function targetFromHeader(content: string): string | undefined {
  const firstLine = content.slice(
    0,
    content.indexOf("\n") === -1 ? undefined : content.indexOf("\n"),
  );
  const match = /^GH_TARGET: (?:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#(\d+)|(\d+))$/.exec(firstLine);
  if (!match) return undefined;
  return match[1] !== undefined ? `${match[1]}#${match[2]}` : match[3];
}

function readRateLimitEntries(): RateLimitEntries | undefined {
  try {
    const source = readFileSync(RATE_LIMIT_PATH, "utf8");
    const parsed: unknown = JSON.parse(source);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("rate limit data is not an object");
    }

    const entries: RateLimitEntries = {};
    for (const [target, timestamps] of Object.entries(parsed)) {
      if (!Array.isArray(timestamps) || !timestamps.every((time) => typeof time === "number")) {
        throw new Error("rate limit data contains invalid entries");
      }
      entries[target] = timestamps;
    }
    return entries;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return {};
    }
    process.stderr.write("gh-safe: unable to read rate limit data; content blocked\n");
    return undefined;
  }
}

function recordRateLimitEvent(target: string): boolean {
  const entries = readRateLimitEntries();
  if (!entries) return false;

  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  for (const [key, times] of Object.entries(entries)) {
    entries[key] = times.filter((time) => time >= cutoff);
  }

  const targetEvents = entries[target] ?? [];
  if (targetEvents.length >= RATE_LIMIT_MAX_EVENTS) {
    try {
      mkdirSync(join(process.cwd(), ".turbo"), { recursive: true });
      writeFileSync(RATE_LIMIT_PATH, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
    } catch {
      process.stderr.write("gh-safe: unable to update rate limit data; content blocked\n");
      return false;
    }
    process.stderr.write("gh-safe: comment rate limit exceeded for this target\n");
    return false;
  }

  targetEvents.push(now);
  entries[target] = targetEvents;

  try {
    mkdirSync(join(process.cwd(), ".turbo"), { recursive: true });
    writeFileSync(RATE_LIMIT_PATH, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
    return true;
  } catch {
    process.stderr.write("gh-safe: unable to record rate limit event; content blocked\n");
    return false;
  }
}

async function main(): Promise<void> {
  let content = "";
  for await (const chunk of process.stdin) {
    content += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
  }

  const sanitized = sanitize(content);
  if (!checkGitleaks(sanitized)) process.exit(1);

  const target = targetFromHeader(sanitized);
  if (target !== undefined && !recordRateLimitEvent(target)) process.exit(1);

  process.stdout.write(sanitized);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error";
  process.stderr.write(`gh-safe: fatal error: ${message}\n`);
  process.exit(1);
});
