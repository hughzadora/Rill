#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { initializeProject } from "./init.js";
import { RillCommandError } from "./command-error.js";
import { adoptProject } from "./adopt.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = readFileSync(resolve(repoRoot, "VERSION"), "utf8").trim();
const help = [
  "Rill Software Factory",
  "",
  "Usage: rill <command> [--json]",
  "",
  "Commands:",
  "  rill version    Print the product SemVer from VERSION",
  "  rill init PATH --goal TEXT [--yes] [--json]   Create a new product (unverified)",
  "  rill adopt PATH [--goal TEXT] [--yes] [--json]   Prepare existing product review (unverified)",
  "  rill --help     Show implemented commands",
].join("\n");

function fail(message: string, json: boolean): void {
  process.stderr.write(json ? `${JSON.stringify({ error: { code: "USAGE", message } })}\n` : `Unknown command: ${message}\n`);
  process.exitCode = 2;
}

const tokens = process.argv.slice(2);
const json = tokens.includes("--json");
const commands = tokens.filter((token) => token !== "--json");

if (commands.length === 1 && (commands[0] === "--help" || commands[0] === "-h")) {
  process.stdout.write(`${help}\n`);
} else if (commands.length === 1 && commands[0] === "version") {
  process.stdout.write(json ? `${JSON.stringify({ version })}\n` : `${version}\n`);
} else if (tokens[0] === "init") {
  try {
    const parsed = parseArgs({
      args: tokens.slice(1),
      options: {
        goal: { type: "string" },
        yes: { type: "boolean" },
        json: { type: "boolean" },
      },
      allowPositionals: true,
      strict: true,
    });
    if (parsed.positionals.length !== 1 || !parsed.values.goal) {
      throw new RillCommandError("Usage: rill init PATH --goal TEXT [--yes] [--json]", 2, "USAGE");
    }
    const receipt = initializeProject(repoRoot, parsed.positionals[0]!, parsed.values.goal, version);
    process.stdout.write(
      json
        ? `${JSON.stringify(receipt)}\n`
        : `Created ${receipt.path} (not verified; native Plugin installation and Hook trust require review).\n`,
    );
  } catch (error) {
    const code = error instanceof RillCommandError ? error.exitCode : 2;
    const category = error instanceof RillCommandError ? error.category : error instanceof TypeError ? "USAGE" : "ENVIRONMENT";
    const message = error instanceof Error ? error.message : "Unknown initialization error";
    process.stderr.write(
      json
        ? `${JSON.stringify({ error: { code: category, message } })}\n`
        : `Rill init failed: ${message}\n`,
    );
    process.exitCode = code;
  }
 } else if (tokens[0] === "adopt") {
  try {
    const parsed = parseArgs({
      args: tokens.slice(1),
      options: {
        goal: { type: "string" },
        yes: { type: "boolean" },
        json: { type: "boolean" },
      },
      allowPositionals: true,
      strict: true,
    });
    if (parsed.positionals.length !== 1) {
      throw new RillCommandError("Usage: rill adopt PATH [--goal TEXT] [--yes] [--json]", 2, "USAGE");
    }
    const receipt = adoptProject(repoRoot, parsed.positionals[0]!, version, parsed.values.goal, parsed.values.yes === true);
    process.stdout.write(json ? `${JSON.stringify(receipt)}\n` : `${receipt.status}: ${receipt.path}\n`);
  } catch (error) {
    const code = error instanceof RillCommandError ? error.exitCode : 2;
    const category = error instanceof RillCommandError ? error.category : error instanceof TypeError ? "USAGE" : "ENVIRONMENT";
    const message = error instanceof Error ? error.message : "Unknown adoption error";
    process.stderr.write(json ? `${JSON.stringify({ error: { code: category, message } })}\n` : `Rill adopt failed: ${message}\n`);
    process.exitCode = code;
  }
} else {
  fail(commands.join(" ") || "(none)", json);
}
