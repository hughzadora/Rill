import { mkdir, mkdtemp, readFile, realpath, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { version } from "../package.json";

const root = await realpath(fileURLToPath(new URL("../", import.meta.url)));
const outputDirectory = join(root, "dist");
const profileRoot = "template/profiles/";

const tracked = Bun.spawnSync(
  [
    "git",
    "ls-files",
    "--cached",
    "-z",
    "--",
    "template/",
    ".agents/skills/rill/",
    "workflow/",
    "modern-ai-dlc-engineering-master-blueprint.md",
    ".editorconfig",
    ".gitattributes",
    ".gitignore",
  ],
  { cwd: root },
);
if (tracked.exitCode !== 0) {
  throw new Error(`Could not list tracked template files. ${tracked.stderr.toString()}`);
}

const files = [...new Set(tracked.stdout.toString().split("\0").filter(Boolean))];
for (const file of [
  "template/AGENTS.md",
  ".agents/skills/rill/SKILL.md",
  "workflow/DELIVERY.md",
  "modern-ai-dlc-engineering-master-blueprint.md",
]) {
  if (!files.includes(file)) throw new Error(`Required template file is not tracked: ${file}`);
}

const common = new Map<string, Uint8Array | string>([["RILL_VERSION", `${version}\n`]]);
const profiles = new Map<string, Map<string, Uint8Array>>();
for (const source of files) {
  const path = join(root, source);
  if ((await realpath(path)) !== path) {
    throw new Error(`Cannot package a linked template path: ${source}`);
  }
  if (!(await stat(path)).isFile()) {
    throw new Error(`Template source must be a regular file: ${source}`);
  }
  const bytes = await readFile(path);
  if (source.startsWith(profileRoot)) {
    const [profile, ...relativePath] = source.slice(profileRoot.length).split("/");
    if (!profile || !/^[a-z\d]+(?:-[a-z\d]+)*$/.test(profile) || !relativePath.length) {
      throw new Error(`Invalid profile source path: ${source}`);
    }
    const entries = profiles.get(profile) ?? new Map<string, Uint8Array>();
    entries.set(relativePath.join("/"), bytes);
    profiles.set(profile, entries);
  } else {
    common.set(source.replace(/^template\//, ""), bytes);
  }
}

await mkdir(outputDirectory, { recursive: true });
const stagingDirectory = await mkdtemp(join(outputDirectory, ".rill-"));
try {
  const artifacts = new Map([["rill", common]]);
  for (const [profile, entries] of profiles) {
    artifacts.set(`rill-${profile}`, new Map([...common, ...entries]));
  }
  for (const [name, entries] of artifacts) {
    const artifactName = `${name}-${version}.tar.gz`;
    const temporaryArtifact = join(stagingDirectory, artifactName);
    const archive = new Bun.Archive(Object.fromEntries(entries), { compress: "gzip" });
    const checksumName = `${artifactName}.sha256`;
    const temporaryChecksum = join(stagingDirectory, checksumName);
    await Bun.write(temporaryArtifact, archive);
    const digest = Bun.CryptoHasher.hash("sha256", await readFile(temporaryArtifact), "hex");
    await Bun.write(temporaryChecksum, `${digest}  ${artifactName}\n`);
    await rename(temporaryArtifact, join(outputDirectory, artifactName));
    await rename(temporaryChecksum, join(outputDirectory, checksumName));
    console.log(`dist/${artifactName}`);
  }
} finally {
  await rm(stagingDirectory, { recursive: true, force: true });
}
