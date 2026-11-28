import { mkdir, mkdtemp, readFile, realpath, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { version } from "../package.json";

import { z } from "zod";
const tarBlockSize = 512;
const tarTimestampOffset = 136;
const tarChecksumOffset = 148;
const tarChecksumLength = 8;
const tarSizeOffset = 124;
const tarSizeLength = 12;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function createArchive(entries: Map<string, Uint8Array | string>) {
  const tarball = await new Bun.Archive(Object.fromEntries(entries)).bytes();
  for (let offset = 0; offset + tarBlockSize <= tarball.length;) {
    const header = tarball.subarray(offset, offset + tarBlockSize);
    if (header.every((byte) => byte === 0)) break;

    header.set(encoder.encode("00000000000\0"), tarTimestampOffset);
    header.fill(0x20, tarChecksumOffset, tarChecksumOffset + tarChecksumLength);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    const checksumField = `${checksum.toString(8).padStart(6, "0")}\0 `;
    header.set(encoder.encode(checksumField), tarChecksumOffset);

    const sizeField = decoder
      .decode(header.subarray(tarSizeOffset, tarSizeOffset + tarSizeLength))
      .replace(/\0.*$/, "")
      .trim();
    const size = z.number().int().nonnegative().safeParse(Number.parseInt(sizeField, 8));
    if (!size.success) {
      throw new Error(`Invalid tar entry size: ${sizeField}`);
    }
    offset += tarBlockSize + Math.ceil(size.data / tarBlockSize) * tarBlockSize;
  }
  return gzipSync(tarball, { level: 9 });
}

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
  "workflow/ADOPT.md",
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
    const parsed = z
      .string()
      .regex(/^[a-z\d]+(?:-[a-z\d]+)*$/)
      .safeParse(profile);
    if (!parsed.success || !relativePath.length) {
      throw new Error(`Invalid profile source path: ${source}`);
    }
    const entries = profiles.get(parsed.data) ?? new Map<string, Uint8Array>();
    entries.set(relativePath.join("/"), bytes);
    profiles.set(parsed.data, entries);
  } else {
    common.set(source.replace(/^template\//, ""), bytes);
  }
}

const projectInstructions = common.get("AGENTS.md");
if (!(projectInstructions instanceof Uint8Array)) {
  throw new Error("Missing shared project instructions");
}

await mkdir(outputDirectory, { recursive: true });
const stagingDirectory = await mkdtemp(join(outputDirectory, ".rill-"));
try {
  const artifacts = new Map([["rill", common]]);
  for (const [profile, entries] of profiles) {
    const project = new Map([...common, ...entries]);
    const profileInstructions = entries.get("AGENTS.md");
    if (profileInstructions) {
      project.set(
        "AGENTS.md",
        `${decoder.decode(projectInstructions).trimEnd()}\n\n${decoder.decode(profileInstructions)}`,
      );
    }
    artifacts.set(`rill-${profile}`, project);
  }
  const kit = new Map<string, Uint8Array | string>([
    ["RILL_VERSION", `${version}\n`],
    ["ADOPT.md", await readFile(join(root, "workflow", "ADOPT.md"))],
  ]);
  for (const [name, entries] of artifacts) {
    const artifactName = `${name}-${version}.tar.gz`;
    const temporaryArtifact = join(stagingDirectory, artifactName);
    const archive = await createArchive(entries);
    const checksumName = `${artifactName}.sha256`;
    await Bun.write(temporaryArtifact, archive);
    const bytes = await readFile(temporaryArtifact);
    const digest = Bun.CryptoHasher.hash("sha256", bytes, "hex");
    kit.set(`templates/${artifactName}`, bytes);
    kit.set(`templates/${checksumName}`, `${digest}  ${artifactName}\n`);
  }
  const kitName = `rill-kit-${version}.tar.gz`;
  const checksumName = `${kitName}.sha256`;
  const kitPath = join(stagingDirectory, kitName);
  const archive = await createArchive(kit);
  await Bun.write(kitPath, archive);
  const digest = Bun.CryptoHasher.hash("sha256", await readFile(kitPath), "hex");
  await Bun.write(join(stagingDirectory, checksumName), `${digest}  ${kitName}\n`);
  await rename(kitPath, join(outputDirectory, kitName));
  await rename(join(stagingDirectory, checksumName), join(outputDirectory, checksumName));
  // console.log(`dist/${kitName}`); — removed per no-console rule
} finally {
  await rm(stagingDirectory, { recursive: true, force: true });
}
