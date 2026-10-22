import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

function withTemporaryDirectory(run: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "rill-config-formats-"));
  try {
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function writeFile(directory: string, path: string, contents: string): void {
  const destination = join(directory, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}

function runCli(directory: string, files: string[] = []) {
  const cli = fileURLToPath(new URL("../tools/check-config-formats.ts", import.meta.url));
  return spawnSync(process.execPath, [cli, ...files], { cwd: directory, encoding: "utf8" });
}

test("accepts required project TOML when no agents directory or YAML files exist", () => {
  withTemporaryDirectory((directory) => {
    writeFile(directory, ".codex/config.toml", "enabled = true\n");
    const result = runCli(directory);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("config syntax: 1 file passed (1 TOML, 0 YAML)\n");
    expect(result.stderr).toBe("");
  });
});

test("discovers YAML files at varied depths with arbitrary names", () => {
  withTemporaryDirectory((directory) => {
    writeFile(directory, ".codex/config.toml", "enabled = true\n");
    writeFile(directory, ".agents/alpha.yaml", "name: alpha\n");
    writeFile(directory, ".agents/nested/beta/custom-name.yaml", "name: beta\n");

    const result = runCli(directory);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("config syntax: 3 files passed (1 TOML, 2 YAML)\n");
    expect(result.stderr).toBe("");
  });
});

test("discovers multiple differently named direct role TOML files", () => {
  withTemporaryDirectory((directory) => {
    writeFile(directory, ".codex/config.toml", "enabled = true\n");
    writeFile(directory, ".codex/agents/worker.toml", "model = 'test'\n");
    writeFile(directory, ".codex/agents/reviewer.toml", "model = 'test'\n");
    writeFile(directory, ".agents/custom.yaml", "name: custom\n");

    const result = runCli(directory);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("config syntax: 4 files passed (3 TOML, 1 YAML)\n");
    expect(result.stderr).toBe("");
  });
});

test("reports malformed discovered TOML and YAML with their paths", () => {
  withTemporaryDirectory((directory) => {
    const roleConfig = ".codex/agents/bad-role.toml";
    const yamlConfig = ".agents/nested/bad-yaml.yaml";
    writeFile(directory, ".codex/config.toml", "enabled = true\n");
    writeFile(directory, roleConfig, "[model\n");
    writeFile(directory, yamlConfig, "name: [\n");

    const result = runCli(directory);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${roleConfig}: Invalid TOML document`);
    expect(result.stderr).toContain(`${yamlConfig}:`);
    expect(result.stderr).toContain("Flow sequence");
    expect(result.stdout).toBe("");
  });
});

test("reports malformed required project TOML with its path during discovery", () => {
  withTemporaryDirectory((directory) => {
    const projectConfig = ".codex/config.toml";
    writeFile(directory, projectConfig, "[model\n");

    const result = runCli(directory);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${projectConfig}: Invalid TOML document`);
    expect(result.stdout).toBe("");
  });
});

test("requires the project TOML during discovery", () => {
  withTemporaryDirectory((directory) => {
    const result = runCli(directory);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".codex/config.toml:");
    expect(result.stdout).toBe("");
  });
});

test("explicit-file mode reports missing supported TOML and YAML paths", () => {
  withTemporaryDirectory((directory) => {
    for (const missing of [".codex/config.toml", ".agents/missing/role.yaml"]) {
      const result = runCli(directory, [missing]);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`${missing}:`);
      expect(result.stdout).toBe("");
    }
  });
});

test("explicit-file mode rejects unsupported config scopes", () => {
  withTemporaryDirectory((directory) => {
    const unsupportedYaml = ".agents/not-yaml.yml";
    const nestedRoleConfig = ".codex/agents/nested/role.toml";
    writeFile(directory, unsupportedYaml, "name: test\n");
    writeFile(directory, nestedRoleConfig, "model = 'test'\n");

    for (const unsupported of [unsupportedYaml, nestedRoleConfig]) {
      const result = runCli(directory, [unsupported]);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`${unsupported}: unsupported config syntax path`);
      expect(result.stdout).toBe("");
    }
  });
});

test("explicit-file mode accepts selected valid TOML while ignoring malformed unselected YAML", () => {
  withTemporaryDirectory((directory) => {
    const projectConfig = ".codex/config.toml";
    writeFile(directory, projectConfig, "enabled = true\n");
    writeFile(directory, ".agents/bad.yaml", "name: [\n");

    const result = runCli(directory, [projectConfig]);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("config syntax: 1 selected file passed (1 TOML, 0 YAML)\n");
    expect(result.stderr).toBe("");
  });
});

test("explicit-file mode accepts selected valid YAML while ignoring malformed unselected TOML", () => {
  withTemporaryDirectory((directory) => {
    const yamlConfig = ".agents/arbitrary-name.yaml";
    writeFile(directory, ".codex/config.toml", "[model\n");
    writeFile(directory, yamlConfig, "name: valid\n");

    const result = runCli(directory, [yamlConfig]);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("config syntax: 1 selected file passed (0 TOML, 1 YAML)\n");
    expect(result.stderr).toBe("");
  });
});

test("explicit-file mode accepts a normalized direct role TOML path", () => {
  withTemporaryDirectory((directory) => {
    const roleFile = ".codex/agents/local-worker.toml";
    writeFile(directory, roleFile, "model = 'test'\n");

    const result = runCli(directory, [`./${roleFile}`]);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("config syntax: 1 selected file passed (1 TOML, 0 YAML)\n");
    expect(result.stderr).toBe("");
  });
});

test("explicit-file mode reports malformed TOML and YAML with their paths", () => {
  withTemporaryDirectory((directory) => {
    const projectConfig = ".codex/config.toml";
    const yamlConfig = ".agents/bad.yaml";
    writeFile(directory, projectConfig, "[model\n");
    writeFile(directory, yamlConfig, "name: [\n");

    const tomlResult = runCli(directory, [projectConfig]);
    expect(tomlResult.error).toBeUndefined();
    expect(tomlResult.status).toBe(1);
    expect(tomlResult.stderr).toContain(`${projectConfig}: Invalid TOML document`);
    expect(tomlResult.stdout).toBe("");

    const yamlResult = runCli(directory, [yamlConfig]);
    expect(yamlResult.error).toBeUndefined();
    expect(yamlResult.status).toBe(1);
    expect(yamlResult.stderr).toContain(`${yamlConfig}:`);
    expect(yamlResult.stderr).toContain("Flow sequence");
    expect(yamlResult.stdout).toBe("");
  });
});
