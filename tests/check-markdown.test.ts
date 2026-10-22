import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const cli = fileURLToPath(new URL("../tools/check-markdown.ts", import.meta.url));
const config = fileURLToPath(new URL("../.markdownlint.json", import.meta.url));

test("checks hidden engineering Skills and reports malformed Markdown", () => {
  const directory = mkdtempSync(join(tmpdir(), "rill-markdown-"));
  const skill = join(directory, ".agents/skills/example/SKILL.md");

  try {
    copyFileSync(config, join(directory, ".markdownlint.json"));
    mkdirSync(join(directory, ".agents/skills/example"), { recursive: true });
    writeFileSync(skill, "# Example\n\n\nMalformed spacing.\n");

    const invalid = spawnSync(process.execPath, [cli], { cwd: directory, encoding: "utf8" });
    expect(invalid.error).toBeUndefined();
    expect(invalid.status, invalid.stderr).toBe(1);
    expect(invalid.stderr).toContain(".agents/skills/example/SKILL.md:3 MD012");

    writeFileSync(skill, "# Example\n\nValid Markdown.\n");
    const valid = spawnSync(process.execPath, [cli], { cwd: directory, encoding: "utf8" });
    expect(valid.error).toBeUndefined();
    expect(valid.status, valid.stderr).toBe(0);
    expect(valid.stdout).toContain("markdownlint: 1 project documents passed");
    expect(valid.stderr).toBe("");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
