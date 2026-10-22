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

function runCli(directory: string, files: string[] = []) {
  return spawnSync(process.execPath, [cli, ...files], { cwd: directory, encoding: "utf8" });
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

test("requires at least one YAML config while allowing zero role TOML files", () => {
  withCopiedConfigFiles((directory) => {
    const yaml = join(directory, ".agents/skills/development-workflow/agents/openai.yaml");
    rmSync(yaml);
    const result = runCli(directory);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".agents/**/*.yaml: no agent configuration files were found");
    expect(result.stdout).toBe("");
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

test("discovers and validates direct role TOML files while allowing zero roles", () => {
  withCopiedConfigFiles((directory) => {
    const emptyResult = runCli(directory);
    expect(emptyResult.status, emptyResult.stderr).toBe(0);
    expect(emptyResult.stdout).toContain("config syntax: 2 files passed (1 TOML, 1 YAML)");

    mkdirSync(join(directory, ".codex/agents"), { recursive: true });
    writeFileSync(join(directory, ".codex/agents/worker.toml"), "model = 'test'\n");
    const validResult = runCli(directory);
    expect(validResult.status, validResult.stderr).toBe(0);
    expect(validResult.stdout).toContain("config syntax: 3 files passed (2 TOML, 1 YAML)");

    writeFileSync(join(directory, ".codex/agents/worker.toml"), "[model\n");
    const malformedResult = runCli(directory);
    expect(malformedResult.status).toBe(1);
    expect(malformedResult.stderr).toContain(".codex/agents/worker.toml: Invalid TOML document");
    expect(malformedResult.stdout).toBe("");
  });
});

test("explicit-file mode validates only the selected config file", () => {
  withCopiedConfigFiles((directory) => {
    const toml = ".codex/config.toml";
    const yaml = ".agents/skills/development-workflow/agents/openai.yaml";
    writeFileSync(join(directory, yaml), "malformed: [\n");

    const result = runCli(directory, [toml]);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("config syntax: 1 selected file passed (1 TOML, 0 YAML)");
    expect(result.stderr).toBe("");
  });
});

test("explicit-file mode accepts a valid YAML file while the unselected TOML is malformed", () => {
  withCopiedConfigFiles((directory) => {
    const toml = ".codex/config.toml";
    const yaml = ".agents/skills/development-workflow/agents/openai.yaml";
    writeFileSync(join(directory, toml), "[agents\nenabled = true\n");

    const result = runCli(directory, [yaml]);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("config syntax: 1 selected file passed (0 TOML, 1 YAML)");
    expect(result.stderr).toBe("");
  });
});

test("explicit-file mode rejects malformed TOML and YAML with their paths", () => {
  withCopiedConfigFiles((directory) => {
    const toml = ".codex/config.toml";
    const yaml = ".agents/skills/development-workflow/agents/openai.yaml";
    writeFileSync(join(directory, toml), "[agents\nenabled = true\n");
    writeFileSync(join(directory, yaml), "malformed: [\n");

    const tomlResult = runCli(directory, [toml]);
    expect(tomlResult.error).toBeUndefined();
    expect(tomlResult.status).toBe(1);
    expect(tomlResult.stderr).toContain(".codex/config.toml: Invalid TOML document");

    const yamlResult = runCli(directory, [yaml]);
    expect(yamlResult.error).toBeUndefined();
    expect(yamlResult.status).toBe(1);
    expect(yamlResult.stderr).toContain(`${yaml}:`);
    expect(yamlResult.stderr).toContain("Flow sequence");
  });
});

test("explicit role TOML selection accepts normalized paths and rejects other TOML scopes", () => {
  withCopiedConfigFiles((directory) => {
    mkdirSync(join(directory, ".codex/agents"), { recursive: true });
    const role = join(directory, ".codex/agents/worker.toml");
    writeFileSync(role, "model = 'test'\n");

    const selected = runCli(directory, ["./.codex/agents/worker.toml"]);
    expect(selected.status, selected.stderr).toBe(0);
    expect(selected.stdout).toContain("config syntax: 1 selected file passed (1 TOML, 0 YAML)");

    const nested = join(directory, ".codex/agents/nested/worker.toml");
    mkdirSync(join(directory, ".codex/agents/nested"), { recursive: true });
    writeFileSync(nested, "model = 'test'\n");
    const rejected = runCli(directory, [nested]);
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain(
      ".codex/agents/nested/worker.toml: unsupported config syntax path",
    );
  });
});
