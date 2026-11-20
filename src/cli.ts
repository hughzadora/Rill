#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = readFileSync(resolve(repoRoot, "VERSION"), "utf8").trim();
const help = [
  "Rill Software Factory",
  "",
  "Usage: rill <command> [--json]",
  "",
  "Commands:",
  "  rill version    Print the product SemVer from VERSION",
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
} else {
  fail(commands.join(" ") || "(none)", json);
}
