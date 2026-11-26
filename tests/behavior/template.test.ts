import { expect, test } from "bun:test";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { version } from "../../package.json";

const project = new URL("../../", import.meta.url);

test("the public build command ships a self-contained, versioned Codex template", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rill template "));
  try {
    for (const file of [
      ".agents",
      "src",
      "template",
      "workflow",
      "modern-ai-dlc-engineering-master-blueprint.md",
      "package.json",
    ]) {
      const source = new URL(file, project);
      await cp(source, join(directory, file), { recursive: true });
    }

    const result = Bun.spawnSync([process.execPath, "run", "build"], { cwd: directory });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    const artifact = Bun.file(join(directory, "dist", `rill-${version}.tar.gz`));
    const files = await new Bun.Archive(await artifact.bytes()).files();

    for (const file of [
      "AGENTS.md",
      ".agents/skills/rill/SKILL.md",
      "modern-ai-dlc-engineering-master-blueprint.md",
      "workflow/DELIVERY.md",
      "RILL_VERSION",
    ]) {
      expect(files.has(file)).toBe(true);
    }
    expect(await files.get("RILL_VERSION")?.text()).toBe(`${version}\n`);
    expect(await files.get("AGENTS.md")?.text()).toContain("workflow/DELIVERY.md");
    expect(files.has("docs/agents/issue-tracker.md")).toBe(false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
