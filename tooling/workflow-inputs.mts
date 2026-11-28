import { statSync } from "node:fs";
import { z } from "zod";

const summary = z.string().regex(/^\S/, "Expected a nonempty summary");
const featureDirectory = z.string().regex(/^specs\/[a-z0-9]+(?:-[a-z0-9]+)*$/);
const declaration = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("Delivery"), value: summary }),
  z.object({ kind: z.literal("Maintenance"), value: summary }),
  z.object({ kind: z.literal("Spec"), value: featureDirectory }),
]);
const declarationLines = z.tuple([z.string()], {
  error: "Provide exactly one Delivery, Spec, or Maintenance declaration in the PR description.",
});

const maintenancePath = z
  .string()
  .regex(
    /^(?:bun\.lock|package\.json|packages\/[^/]+\/package\.json|\.github\/workflows\/[^/]+\.ya?ml)$/,
    "Dependabot changes outside the maintenance scope require an explicit declaration.",
  );
const maintenancePages = z.array(
  z.array(z.object({ filename: maintenancePath, previous_filename: maintenancePath.nullish() })),
);
const pullRequest = z.object({
  PR_BODY: z.string().default(""),
  PR_AUTHOR: z.string().min(1),
  GITHUB_REPOSITORY: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  PR_NUMBER: z.string().regex(/^[1-9][0-9]*$/),
  PR_FILE_COUNT: z
    .string()
    .regex(/^[0-9]+$/)
    .transform(Number),
});
const publish = z.object({
  NPM_PACKAGE: z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/),
});
const release = z.object({
  RELEASE_VERSION: z.string().regex(/^v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/),
});

function validateDelivery() {
  const request = pullRequest.parse(process.env);
  const lines = request.PR_BODY.replaceAll("\r", "")
    .split("\n")
    .filter((line) => /^(?:Delivery|Maintenance|Spec):/.test(line));

  if (lines.length === 0 && request.PR_AUTHOR === "dependabot[bot]") {
    const result = Bun.spawnSync([
      "gh",
      "api",
      "--paginate",
      "--slurp",
      `repos/${request.GITHUB_REPOSITORY}/pulls/${request.PR_NUMBER}/files`,
    ]);
    if (result.exitCode !== 0) throw new Error(result.stderr.toString());

    const pages = maintenancePages.parse(JSON.parse(result.stdout.toString()));
    const count = pages.reduce((total, page) => total + page.length, 0);
    if (count === 0 || count !== request.PR_FILE_COUNT) {
      throw new Error("Could not verify every Dependabot change. Provide an explicit declaration.");
    }
    return;
  }

  const [line] = declarationLines.parse(lines);
  const separator = line.indexOf(":");
  const record = declaration.parse({
    kind: line.slice(0, separator),
    value: line[separator + 1] === " " ? line.slice(separator + 2) : undefined,
  });
  if (record.kind !== "Spec") return;

  const prerequisites = Bun.spawnSync(
    ["bash", ".specify/scripts/bash/check-prerequisites.sh", "--require-spec", "--require-tasks"],
    {
      env: {
        ...process.env,
        SPECIFY_FEATURE_DIRECTORY: record.value,
        SPECIFY_FEATURE_NO_PERSIST: "1",
      },
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  if (prerequisites.exitCode !== 0) process.exit(prerequisites.exitCode || 1);

  for (const artifact of ["spec.md", "tasks.md", "acceptance.md"]) {
    const path = `${record.value}/${artifact}`;
    if (!statSync(path, { throwIfNoEntry: false })?.size) {
      throw new Error(`Missing or empty delivery record: ${path}`);
    }
  }
}

switch (z.enum(["delivery", "publish", "release"]).parse(process.argv[2])) {
  case "delivery":
    validateDelivery();
    break;
  case "publish":
    publish.parse(process.env);
    break;
  case "release":
    release.parse(process.env);
    break;
}
