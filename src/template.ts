import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { version } from "../package.json";

const root = new URL("../", import.meta.url);
const templateFiles = {
  "AGENTS.md": "template/AGENTS.md",
  ".agents/skills/rill/SKILL.md": ".agents/skills/rill/SKILL.md",
  "modern-ai-dlc-engineering-master-blueprint.md": "modern-ai-dlc-engineering-master-blueprint.md",
  "workflow/DELIVERY.md": "workflow/DELIVERY.md",
};

const entries: Record<string, Uint8Array | string> = { RILL_VERSION: `${version}\n` };
for (const [destination, source] of Object.entries(templateFiles)) {
  entries[destination] = await Bun.file(new URL(source, root)).bytes();
}

const outputDirectory = fileURLToPath(new URL("dist/", root));
const artifactName = `rill-${version}.tar.gz`;
await mkdir(outputDirectory, { recursive: true });
const stagingDirectory = await mkdtemp(join(outputDirectory, ".rill-"));
try {
  const temporaryArtifact = join(stagingDirectory, artifactName);
  await Bun.write(temporaryArtifact, new Bun.Archive(entries, { compress: "gzip" }));
  await rename(temporaryArtifact, join(outputDirectory, artifactName));
} finally {
  await rm(stagingDirectory, { recursive: true, force: true });
}

console.log(`dist/${artifactName}`);
