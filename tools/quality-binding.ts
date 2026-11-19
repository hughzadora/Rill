import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const releaseSchema = z.object({
  schemaVersion: z.literal(1),
  release: z.string().regex(/^\d+\.\d+\.\d+$/),
  stage: z.literal("candidate"),
  policy: z.object({
    commit: z.literal("lint"),
    pullRequest: z.literal("full-spec-ci"),
    unverified: z.literal("blocked"),
  }),
  stacks: z
    .array(
      z.object({
        id: z.string().min(1),
        markers: z.array(z.string().min(1)),
        gates: z.array(z.string().min(1)),
      }),
    )
    .min(1),
});

export type QualityRelease = z.infer<typeof releaseSchema>;
export interface BindingChange {
  path: string;
  before: string | null;
  afterSha256: string;
}
export interface BindingPlan {
  planId: string;
  status: "ready" | "blocked" | "conflict";
  changes: BindingChange[];
  reason: string | null;
  releaseDigest: string | null;
}
export interface BoundProfile {
  schemaVersion: 1;
  release: string;
  standardDigest: string;
  source: "rill-quality";
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function qualityRelease(version: string) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return null;
  const filename = fileURLToPath(
    new URL(`../quality-standards/${version}/profile.json`, import.meta.url),
  );
  if (!existsSync(filename)) return null;
  const raw = readFileSync(filename, "utf8");
  const manifest = releaseSchema.parse(JSON.parse(raw));
  if (manifest.release !== version) return null;
  return { manifest, digest: sha256(raw) };
}

export function profilePath(root: string) {
  return resolve(root, ".quality-standard", "profile.json");
}

export function readBoundProfile(root: string) {
  const path = profilePath(root);
  if (!existsSync(path) || !lstatSync(path).isFile()) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const bound = z
      .object({
        schemaVersion: z.literal(1),
        release: z.string().regex(/^\d+\.\d+\.\d+$/),
        standardDigest: z.string().regex(/^[0-9a-f]{64}$/),
        source: z.literal("rill-quality"),
      })
      .parse(JSON.parse(raw));
    const release = qualityRelease(bound.release);
    return {
      bound,
      digest: sha256(raw),
      valid: release?.digest === bound.standardDigest,
    };
  } catch {
    return { bound: null, digest: null, valid: false };
  }
}

function targetState(root: string) {
  const directory = resolve(root, ".quality-standard");
  const path = profilePath(root);
  if (existsSync(directory) && !lstatSync(directory).isDirectory()) {
    return { unsafe: true, contents: null };
  }
  if (existsSync(path) && !lstatSync(path).isFile()) {
    return { unsafe: true, contents: null };
  }
  return {
    unsafe: false,
    contents: existsSync(path) ? readFileSync(path, "utf8") : null,
  };
}

export function bindingPlan(
  root: string,
  revision: string,
  releaseName: string,
  workingTreeState: unknown,
): BindingPlan {
  const release = qualityRelease(releaseName);
  const target = targetState(root);
  const planId = sha256(
    JSON.stringify({
      root,
      revision,
      workingTreeState,
      releaseName,
      releaseDigest: release?.digest ?? null,
      target: target.contents === null ? null : sha256(target.contents),
      unsafe: target.unsafe,
    }),
  );
  if (!release) {
    return {
      planId,
      status: "blocked",
      changes: [],
      reason: `No locally available quality release: ${releaseName}`,
      releaseDigest: null,
    };
  }
  if (target.unsafe || target.contents !== null) {
    return {
      planId,
      status: "conflict",
      changes: [],
      reason:
        "Existing or non-regular profile target requires separate reconciliation.",
      releaseDigest: release.digest,
    };
  }
  const proposed = profileContent(releaseName, release.digest);
  return {
    planId,
    status: "ready",
    changes: [
      {
        path: ".quality-standard/profile.json",
        before: null,
        afterSha256: sha256(proposed),
      },
    ],
    reason: null,
    releaseDigest: release.digest,
  };
}

function profileContent(release: string, standardDigest: string) {
  const profile: BoundProfile = {
    schemaVersion: 1,
    release,
    standardDigest,
    source: "rill-quality",
  };
  return `${JSON.stringify(profile, null, 2)}\n`;
}

export function applyBinding(root: string, plan: BindingPlan, release: string) {
  if (plan.status !== "ready" || !plan.releaseDigest) return false;
  const directory = resolve(root, ".quality-standard");
  if (!existsSync(directory)) mkdirSync(directory);
  if (!lstatSync(directory).isDirectory()) return false;
  writeFileSync(
    profilePath(root),
    profileContent(release, plan.releaseDigest),
    { flag: "wx" },
  );
  return true;
}
