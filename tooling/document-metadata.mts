import { lstat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { z } from "zod";

const documentId = z.string().regex(/^[A-Z]+-\d{3,}$/);
const metadata = z
  .strictObject({
    id: documentId,
    title: z.string().trim().min(1),
    status: z.enum(["draft", "active", "completed", "deprecated", "superseded"]),
    superseded_by: documentId.nullable(),
    last_updated: z.iso.date(),
    related_code: z.array(
      z
        .string()
        .min(1)
        .refine(
          (path) =>
            !isAbsolute(path) &&
            !path.includes("\\") &&
            path
              .split("/")
              .every((segment) => segment !== "" && segment !== "." && segment !== ".."),
          "Expected a repository-relative path",
        ),
    ),
  })
  .refine((record) => record.status !== "superseded" || record.superseded_by !== null, {
    path: ["superseded_by"],
    message: "A superseded document must name its replacement",
  });

const paths = Bun.spawnSync([
  "git",
  "ls-files",
  "-z",
  "--cached",
  "--others",
  "--exclude-standard",
  "--",
  "*.md",
  ":!SKILL.md",
  ":!.omp/commands/**",
  ":!.specify/extensions/**",
  ":!.specify/templates/**",
]);
if (paths.exitCode !== 0) throw new Error(paths.stderr.toString());

const removed = Bun.spawnSync(["git", "ls-files", "-z", "--deleted"]);
if (removed.exitCode !== 0) throw new Error(removed.stderr.toString());
const removedPaths = new Set(removed.stdout.toString().split("\0"));

const documents = new Map<string, string>();
const replacements = new Map<string, string>();
const errors: string[] = [];

const changesetRecord = /^\.changeset\/[^/]+\.md$/;
const workspaceChangelog = /^(?:packages\/[^/]+\/)?CHANGELOG\.md$/;
const specKitArtifact =
  /^specs\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:(?:spec|plan|tasks|research|data-model|quickstart)\.md|checklists\/[^/]+\.md|contracts\/.+\.md)$/;
const specKitTasks = /^specs\/[a-z0-9]+(?:-[a-z0-9]+)*\/tasks\.md$/;
const assessmentArtifact =
  /^\.specify\/assessments\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:intake|research|problem|concept|decision)\.md$/;
const taskDescription = z.strictObject({ description: z.string().trim().min(1) });

for (const path of new Set(paths.stdout.toString().split("\0").filter(Boolean))) {
  if (removedPaths.has(path)) continue;
  if (changesetRecord.test(path) && path !== ".changeset/README.md") continue;
  if (workspaceChangelog.test(path)) continue;
  try {
    const source = await Bun.file(path).text();
    if (
      (specKitArtifact.test(path) || assessmentArtifact.test(path)) &&
      !/^---(?:\r?\n|$)/.test(source)
    )
      continue;
    const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)?.[1];
    if (!header) throw new Error("Missing YAML front matter");
    const parsed = Bun.YAML.parse(header);
    if (specKitTasks.test(path) && taskDescription.safeParse(parsed).success) continue;
    const record = metadata.parse(parsed);
    const existing = documents.get(record.id);
    if (existing) throw new Error(`Duplicate ID ${record.id} also used by ${existing}`);
    documents.set(record.id, path);
    if (record.superseded_by) replacements.set(record.id, record.superseded_by);
    for (const relatedPath of record.related_code) {
      try {
        await lstat(relatedPath);
      } catch (error) {
        errors.push(`${path}: cannot read related_code path ${relatedPath}: ${String(error)}`);
      }
    }
  } catch (error) {
    errors.push(`${path}: ${String(error)}`);
  }
}

for (const [id, replacement] of replacements) {
  if (id === replacement || !documents.has(replacement)) {
    errors.push(
      `${documents.get(id)}: superseded_by must name another document, got ${replacement}`,
    );
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated metadata for ${documents.size} documents.`);
}
