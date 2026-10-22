import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const cli = fileURLToPath(new URL("../tools/check-config-formats.ts", import.meta.url));
const tomlSource = fileURLToPath(new URL("../.codex/config.toml", import.meta.url));
const yamlSource = fileURLToPath(
  new URL("../.agents/skills/development-workflow/agents/openai.yaml", import.meta.url),
);

function withCopiedConfigFiles(run: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "rill-config-formats-"));
  const toml = join(directory, ".codex/config.toml");
  const yaml = join(directory, ".agents/skills/development-workflow/agents/openai.yaml");

  try {
    mkdirSync(join(directory, ".codex"), { recursive: true });
    mkdirSync(join(directory, ".agents/skills/development-workflow/agents"), { recursive: true });
    copyFileSync(tomlSource, toml);
    copyFileSync(yamlSource, yaml);
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function runCli(directory: string) {
  return spawnSync(process.execPath, [cli], { cwd: directory, encoding: "utf8" });
}

test("accepts the current project TOML and YAML syntax in an isolated copy", () => {
  withCopiedConfigFiles((directory) => {
    const result = runCli(directory);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("config syntax: 2 files passed (1 TOML, 1 YAML)");
    expect(result.stderr).toBe("");
  });
});

test("reports malformed TOML with its file path and parser diagnostic", () => {
  withCopiedConfigFiles((directory) => {
    writeFileSync(join(directory, ".codex/config.toml"), "[agents\nenabled = true\n");
    const result = runCli(directory);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".codex/config.toml: Invalid TOML document");
    expect(result.stdout).toBe("");
  });
});

test("reports malformed YAML with its file path and parser diagnostic", () => {
  withCopiedConfigFiles((directory) => {
    const yaml = join(directory, ".agents/skills/development-workflow/agents/openai.yaml");
    const source = readFileSync(yaml, "utf8");
    writeFileSync(yaml, `${source}\nmalformed: [\n`);
    const result = runCli(directory);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".agents/skills/development-workflow/agents/openai.yaml:");
    expect(result.stderr).toContain("Flow sequence");
    expect(result.stdout).toBe("");
  });
});
