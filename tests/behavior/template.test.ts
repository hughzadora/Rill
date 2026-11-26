import { expect, test } from "bun:test";
import { cp, mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { version } from "../../package.json";

const project = new URL("../../", import.meta.url);

test("the public build command ships a self-contained, versioned Codex template", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rill template "));
  try {
    for (const file of [
      ".agents",
      ".editorconfig",
      ".gitattributes",
      ".gitignore",
      "src",
      "template",
      "workflow",
      "modern-ai-dlc-engineering-master-blueprint.md",
      "package.json",
    ]) {
      const source = new URL(file, project);
      await cp(source, join(directory, file), { recursive: true });
    }

    for (const args of [
      ["init", "-q"],
      ["add", "--all"],
    ]) {
      const git = Bun.spawnSync(["git", ...args], { cwd: directory });
      expect(git.exitCode, git.stderr.toString()).toBe(0);
    }
    await writeFile(join(directory, "template", "uncommitted.txt"), "must not ship");

    const result = Bun.spawnSync([process.execPath, "run", "build"], { cwd: directory });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    const artifactName = `rill-${version}.tar.gz`;
    const outputDirectory = join(directory, "dist");
    const artifact = Bun.file(join(outputDirectory, artifactName));
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
    expect(files.has("uncommitted.txt")).toBe(false);

    const initial = await artifact.bytes();
    const rebuilt = Bun.spawnSync([process.execPath, "run", "build"], { cwd: directory });
    expect(rebuilt.exitCode, rebuilt.stderr.toString()).toBe(0);
    expect(await artifact.bytes()).toEqual(initial);

    const checksum = ["shasum", "-a", "256", "-c", `${artifactName}.sha256`];
    const validChecksum = Bun.spawnSync(checksum, { cwd: outputDirectory });
    expect(validChecksum.exitCode, validChecksum.stderr.toString()).toBe(0);
    await Bun.write(artifact, "corrupted archive");
    const invalidChecksum = Bun.spawnSync(checksum, { cwd: outputDirectory });
    expect(invalidChecksum.exitCode).not.toBe(0);
    expect(invalidChecksum.stdout.toString()).toContain("FAILED");
    await Bun.write(artifact, initial);

    await rename(join(directory, "workflow"), join(directory, "relocated-workflow"));
    await symlink(join(directory, "relocated-workflow"), join(directory, "workflow"));
    const invalid = Bun.spawnSync([process.execPath, "run", "build"], { cwd: directory });
    expect(invalid.exitCode).not.toBe(0);
    expect(invalid.stderr.toString()).toContain("linked template path");
    expect(await artifact.bytes()).toEqual(initial);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
