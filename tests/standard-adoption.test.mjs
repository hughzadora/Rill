import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, test } from "node:test";

const repository = resolve(import.meta.dirname, "..");
const fixtureVersion = "v0.1.0";
const appVersion = readFileSync(join(repository, "VERSION"), "utf8").trim();
let sandbox;
let template;

function execute(program, args, options = {}) {
  const environment = { ...process.env, ...options.env, MISE_QUIET: "1" };
  // Test subprocesses must not inherit the parent node:test harness context,
  // otherwise Node silently skips recursive tests and produces a false pass.
  delete environment.NODE_TEST_CONTEXT;
  const result = spawnSync(program, args, {
    cwd: options.cwd ?? repository,
    encoding: "utf8",
    env: environment,
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (options.mustFail) {
    assert.notEqual(
      result.status,
      0,
      "Unexpected success: " +
        program +
        " " +
        args.join(" ") +
        "\n" +
        result.stdout +
        "\n" +
        result.stderr,
    );
  } else {
    assert.equal(
      result.status,
      0,
      [program, ...args, result.stdout, result.stderr].join("\n"),
    );
  }
  return result.stdout + result.stderr;
}

function pinned(tools, command, args, options = {}) {
  return execute(
    "mise",
    ["-C", repository, "exec", "--locked", ...tools, "--", command, ...args],
    options,
  );
}

function git(directory, args) {
  return execute("git", [
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "user.name=Rill tests",
    "-c",
    "user.email=rill-tests@example.test",
    "-C",
    directory,
    ...args,
  ]).trim();
}

function file(directory, name, content) {
  const destination = join(directory, name);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, content, "utf8");
}

function copyStandard(destination, answers) {
  const detectedOwnership = {
    preserve_justfile: existsSync(join(destination, "justfile")),
    preserve_agent_entry: existsSync(join(destination, "AGENTS.md")),
    preserve_codex_roles:
      existsSync(join(destination, ".codex/config.toml")) ||
      existsSync(join(destination, ".codex/agents/reviewer.toml")),
    preserve_hook_config: existsSync(join(destination, ".codex/hooks.json")),
    preserve_rill_skills: existsSync(
      join(destination, ".agents/skills/rill-adopt/SKILL.md"),
    ),
  };
  const args = [
    "copy",
    "--defaults",
    "--vcs-ref",
    fixtureVersion,
    ...Object.entries({ ...detectedOwnership, ...answers }).flatMap(
      ([key, value]) => ["--data", key + "=" + value],
    ),
    template,
    destination,
  ];
  return pinned(["pypi:copier"], "copier", args);
}

function callRill(args, options = {}) {
  return execute(join(repository, ".venv/bin/rill"), args, options);
}

function invokeRillHook(project, event, toolInput = {}) {
  const result = spawnSync(join(repository, ".venv/bin/rill"), ["hook", event], {
    cwd: project,
    input: JSON.stringify({ tool_input: toolInput }),
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

function verifyWorkflow(destination) {
  const generated = join(destination, ".github/workflows/rill-quality.yml");
  pinned(["aqua:rhysd/actionlint"], "actionlint", [generated]);
  return readFileSync(generated, "utf8");
}

function verifySingleRunner(project) {
  const workflow = verifyWorkflow(project);
  const jobs = workflow.slice(workflow.indexOf("\njobs:\n") + 7);
  assert.deepEqual([...jobs.matchAll(/^ {2}([a-z][\w-]*):$/gm)].map((match) => match[1]), ["quality"]);
  assert.match(workflow, /runs-on: ubuntu-latest/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.match(workflow, /draft == false/);
  assert.match(workflow, /paths-ignore:/);
  assert.match(workflow, /just setup-ci/);
  assert.match(workflow, /just ci/);
  assert.doesNotMatch(workflow, /playwright install|playwright test|ci-full/);
  return workflow;
}

function verifyJustfile(project, profile) {
  const justfile = readFileSync(join(project, "justfile"), "utf8");
  assert.match(justfile, /setup-ci:/);
  assert.match(justfile, /ci:/);
  assert.match(justfile, /ci-full:/);
  execute("just", ["--list"], { cwd: project });
  for (const fragment of profile) assert.ok(justfile.includes(fragment), fragment);
  return justfile;
}

function newProduct(directory) {
  const files = {
    "package.json":
      JSON.stringify(
        {
          name: "independent-http-service",
          private: true,
          type: "module",
          packageManager: "pnpm@12.18.0",
          scripts: {
            lint: "biome check src tests",
            typecheck: "tsc --noEmit",
            "test:unit":
              "node --experimental-strip-types --test tests/unit.test.ts",
            "test:integration":
              "node --experimental-strip-types --test tests/integration/health.test.ts",
            "test:coverage":
              "node --experimental-strip-types --test --experimental-test-coverage --test-coverage-lines=70 --test-coverage-include=src/server.ts tests/unit.test.ts tests/integration/health.test.ts",
            build: "tsc --outDir dist",
          },
          devDependencies: {
            typescript: "7.0.2",
            "@types/node": "24.19.2",
            "@biomejs/biome": "2.6.8",
            c8: "12.0.0",
          },
        },
        null,
        2,
      ) + "\n",
    "tsconfig.json":
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2024",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            types: ["node"],
            outDir: "dist",
            rootDir: "src",
          },
          include: ["src/**/*.ts"],
        },
        null,
        2,
      ) + "\n",
    "biome.json":
      JSON.stringify(
        {
          $schema: "https://biomejs.dev/schemas/2.6.8/schema.json",
          files: { includes: ["src/**", "tests/**"] },
          linter: { enabled: true, rules: { recommended: true } },
        },
        null,
        2,
      ) + "\n",
    "src/server.ts": [
      'import { createServer } from "node:http";',
      "",
      "export function sum(left: number, right: number): number {",
      "  return left + right;",
      "}",
      "",
      "export function app() {",
      "  return createServer((request, response) => {",
      '    if (request.url === "/health") {',
      '      response.writeHead(200, { "content-type": "application/json" });',
      "      response.end(JSON.stringify({ ready: true }));",
      "      return;",
      "    }",
      "    response.writeHead(404);",
      '    response.end("Not found");',
      "  });",
      "}",
      "",
    ].join("\n"),
    "tests/unit.test.ts": [
      'import assert from "node:assert/strict";',
      'import { test } from "node:test";',
      'import { sum } from "../src/server.ts";',
      "",
      'test("adding negative and positive values preserves the contract", () => {',
      "  assert.equal(sum(-3, 5), 2);",
      "  assert.equal(sum(7, 2), 9);",
      "});",
      "",
    ].join("\n"),
    "tests/integration/health.test.ts": [
      'import assert from "node:assert/strict";',
      'import { test } from "node:test";',
      'import { app } from "../../src/server.ts";',
      "",
      'test("HTTP health and failure routes", async () => {',
      '  const server = app().listen(0, "127.0.0.1");',
      "  try {",
      "    await new Promise((resolve) => server.once('listening', resolve));",
      "    const address = server.address();",
      '    if (address === null || typeof address === "string") throw new Error("Missing address");',
      '    const base = "http://127.0.0.1:" + address.port;',
      '    const healthy = await fetch(base + "/health");',
      "    assert.equal(healthy.status, 200);",
      "    assert.deepEqual(await healthy.json(), { ready: true });",
      '    const missing = await fetch(base + "/missing");',
      "    assert.equal(missing.status, 404);",
      "  } finally {",
      "    server.close();",
      "  }",
      "});",
      "",
    ].join("\n"),
    "README.md":
      "# Pre-existing independent API\n\nDo not erase this application's scope.\n",
    "AGENTS.md":
      "# Existing native agent rules\n\nPreserve product-specific standards.\n",
    ".github/workflows/existing.yml":
      "name: Existing quality\non: [pull_request]\njobs:\n  original:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo original-quality\n",
    "docs/product.md":
      "# Independent product requirements\n\nProtected unrelated work.\n",
    ".gitignore": "node_modules/\ndist/\ncoverage/\n.nyc_output/\n",
  };
  for (const [name, content] of Object.entries(files))
    file(directory, name, content);
  git(directory, ["init", "-q", "-b", "main"]);
  return files;
}

before(() => {
  sandbox = mkdtempSync(join(tmpdir(), "rill-adoption-regression-"));
  template = join(sandbox, "template");
  cpSync(join(repository, "standards/template"), template, { recursive: true });
  git(template, ["init", "-q", "-b", "main"]);
  git(template, ["add", "."]);
  git(template, ["commit", "-qm", "Versioned Rill profile template"]);
  git(template, ["tag", "v0.1.0"]);
});

after(() => {
  if (sandbox) rmSync(sandbox, { recursive: true, force: true });
});

test("Rill CLI adoption, upgrade, and template distribution", () => {
  const product = join(sandbox, "one-command-consumer");
  assert.equal(JSON.parse(callRill(["--json", "version"])).version, appVersion);
  callRill(["init", product, "--yes", "--data", "project_name=One Command Consumer"]);
  for (const entry of [".codex/agents/worker.toml", ".agents/skills/rill-review/SKILL.md", ".codex/hooks.json"]) {
    assert.ok(existsSync(join(product, entry)), entry);
  }
  assert.equal(JSON.parse(callRill(["status", product])).installed, true);
  assert.equal(git(product, ["log", "-1", "--pretty=%s"]), "chore(rill): initialize harness");
  callRill(["upgrade", product, "--yes"]);
  assert.equal(JSON.parse(callRill(["status", product])).state.version, appVersion);
  assert.equal(git(product, ["status", "--porcelain"]), "");
});

test("CLI installer refuses untracked data even when Git hides untracked files", () => {
  const product = join(sandbox, "untracked-consumer");
  newProduct(product);
  git(product, ["add", "."]);
  git(product, ["commit", "-qm", "Product baseline"]);
  file(product, "private-untracked-note.txt", "Do not modify this work.\n");
  const refused = callRill(["init", product, "--yes"], {
    mustFail: true,
    env: {
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "status.showUntrackedFiles",
      GIT_CONFIG_VALUE_0: "no",
    },
  });
  assert.match(refused, /Dirty target/);
  assert.equal(existsSync(join(product, ".rill/STANDARD.md")), false);
});

test("greenfield four-stack profile has pinned native provenance and valid Actions", () => {
  const project = join(sandbox, "full-profile-consumer");
  mkdirSync(project);
  copyStandard(project, { project_name: "Full profile", react: true, node: true, python: true, shell: true });
  const workflow = verifySingleRunner(project);
  assert.match(workflow, /cache: pnpm/);
  assert.match(workflow, /enable-cache: true/);
  verifyJustfile(project, ["gitleaks git", "pnpm --dir", "uv --directory", "bats", "ci-full:"]);
  assert.ok(existsSync(join(project, ".codex/config.toml")));
  assert.ok(existsSync(join(project, ".agents/skills/rill-review/SKILL.md")));
  // The factory must not report success if the product lacks its required real source.
  execute("just", ["ci"], { cwd: project, mustFail: true });
});

test("nested pnpm projects keep scoped cache and package paths", () => {
  const project = join(sandbox, "nested-pnpm-workspace");
  mkdirSync(project);
  copyStandard(project, { project_name: "Nested React", react: true, node: false, python: false, shell: false, js_workspace: "frontend", react_root: "." });
  const workflow = verifySingleRunner(project);
  assert.match(workflow, /cache-dependency-path: "frontend\/pnpm-lock\.yaml"/);
  assert.match(workflow, /pnpm\/action-setup@/);
  verifyJustfile(project, ['pnpm --dir "frontend"', 'pnpm --dir "frontend/.' + '" run test:unit']);
  assert.ok(!existsSync(join(project, "package.json")));
});

test("native project parent is recorded or remains explicitly unbound", () => {
  const project = join(sandbox, "issue-enrollment");
  mkdirSync(project);
  copyStandard(project, {
    project_name: "Native project enrollment",
    github_parent_issue: 22,
  });
  const doc = readFileSync(join(project, ".rill/STANDARD.md"), "utf8");
  assert.match(doc, /GitHub issue # 22/);
  assert.doesNotMatch(doc, /NOT ENROLLED/);
  assert.match(doc, /not a runtime verification/i);
});

test("native Node profile preserves deterministic unit, integration and coverage gates", () => {
  const project = join(sandbox, "node-vitest-profile");
  mkdirSync(project);
  copyStandard(project, { project_name: "Node vitest", node: true, react: false, python: false, shell: false, node_root: ".", node_test_runner: "vitest" });
  verifySingleRunner(project);
  verifyJustfile(project, ["run test:unit", "run test:integration", "run test:coverage", "run build"]);
  execute("just", ["ci"], { cwd: project, mustFail: true });
});

test("invalid profiles and paths cannot silently create a passing workflow", () => {
  const empty = join(sandbox, "invalid-empty");
  mkdirSync(empty);
  const noStack = pinned(
    ["pypi:copier"],
    "copier",
    [
      "copy",
      "--defaults",
      "--vcs-ref",
      "v0.1.0",
      "-d",
      "react=false",
      "-d",
      "node=false",
      "-d",
      "python=false",
      "-d",
      "shell=false",
      template,
      empty,
    ],
    { mustFail: true },
  );
  assert.match(noStack, /Select at least one real product stack/);

  const outside = join(sandbox, "invalid-path");
  mkdirSync(outside);
  const escaped = pinned(
    ["pypi:copier"],
    "copier",
    [
      "copy",
      "--defaults",
      "--vcs-ref",
      "v0.1.0",
      "-d",
      "node_root=../outside",
      template,
      outside,
    ],
    { mustFail: true },
  );
  assert.match(escaped, /Use a path inside the product repository/);

  const sourceInjection = join(sandbox, "invalid-shell-expansion");
  mkdirSync(sourceInjection);
  const rejected = pinned(
    ["pypi:copier"],
    "copier",
    [
      "copy",
      "--defaults",
      "--vcs-ref",
      "v0.1.0",
      "-d",
      "shell_sources=$(touch /tmp/rill-should-not-exist)",
      template,
      sourceInjection,
    ],
    { mustFail: true },
  );
  assert.match(rejected, /Use a path inside the product repository/);
  assert.ok(!existsSync("/tmp/rill-should-not-exist"));

  const nestedTraversal = join(sandbox, "invalid-nested-traversal");
  mkdirSync(nestedTraversal);
  const rejectedTraversal = pinned(
    ["pypi:copier"],
    "copier",
    [
      "copy",
      "--defaults",
      "--vcs-ref",
      "v0.1.0",
      "-d",
      "node_root=apps/../outside",
      template,
      nestedTraversal,
    ],
    { mustFail: true },
  );
  assert.match(rejectedTraversal, /Use a path inside the product repository/);
  const optionPath = join(sandbox, "invalid-option-path");
  mkdirSync(optionPath);
  const rejectedOption = pinned(
    ["pypi:copier"],
    "copier",
    [
      "copy",
      "--defaults",
      "--vcs-ref",
      "v0.1.0",
      "-d",
      "python_integration=-h",
      template,
      optionPath,
    ],
    { mustFail: true },
  );
  assert.match(rejectedOption, /Use a path inside the product repository/);
});

test("CLI hooks deny framework writes and retain compact symbols", () => {
  const product = join(sandbox, "hook-consumer");
  callRill(["init", product, "--yes"]);
  file(product, "src/service.py", "def service(): return 1\n");
  git(product, ["add", "."]);
  if (git(product, ["status", "--porcelain"])) git(product, ["commit", "-qm", "Install source"]);
  assert.equal(invokeRillHook(product, "session-start").state.mode, "normal");
  const denied = invokeRillHook(product, "pre-tool-use", { file_path: ".codex/hooks.json" });
  assert.equal(denied.hookSpecificOutput.permissionDecision, "deny");
  assert.match(denied.hookSpecificOutput.permissionDecisionReason, /Tier 0/);
  assert.deepEqual(invokeRillHook(product, "pre-compact"), {});
  assert.match(readFileSync(join(product, ".rill/symbols.txt"), "utf8"), /service/);
  assert.deepEqual(invokeRillHook(product, "stop"), {});
  const stateFile = join(product, ".rill/state.json");
  const state = JSON.parse(readFileSync(stateFile, "utf8"));
  state.budget_exhausted = true;
  writeFileSync(stateFile, JSON.stringify(state));
  const quota = invokeRillHook(product, "pre-tool-use", { file_path: "src/next.py" });
  assert.equal(quota.hookSpecificOutput.permissionDecision, "deny");
  assert.match(quota.hookSpecificOutput.permissionDecisionReason, /budget/i);
});

test("CLI status does not trust GH_REPO environment overrides", () => {
  const product = join(sandbox, "origin-bound-consumer");
  callRill(["init", product, "--yes", "--data", "github_parent_issue=22"]);
  git(product, ["add", "."]);
  if (git(product, ["status", "--porcelain"])) git(product, ["commit", "-qm", "Install Rill"]);
  git(product, ["remote", "add", "origin", "https://github.com/acme/target.git"]);
  const status = JSON.parse(callRill(["status", product], { env: { GH_REPO: "acme/wrong" } }));
  assert.equal(status.repository, product);
  assert.equal(status.installed, true);
  assert.deepEqual(status.violations, []);
});

test("CLI upgrade preserves product-owned settings, rejects modified managed files", () => {
  const product = join(sandbox, "managed-upgrade-consumer");
  newProduct(product);
  git(product, ["add", "."]);
  git(product, ["commit", "-qm", "Product baseline"]);
  const ownAgent = readFileSync(join(product, "AGENTS.md"), "utf8");
  callRill(["init", product, "--yes", "--data", "react=false", "--data", "node=true"]);
  assert.equal(readFileSync(join(product, "AGENTS.md"), "utf8"), ownAgent);
  git(product, ["add", "."]);
  if (git(product, ["status", "--porcelain"])) git(product, ["commit", "-qm", "Install native roles"]);
  const hooksPath = join(product, ".codex/hooks.json");
  writeFileSync(hooksPath, readFileSync(hooksPath, "utf8").replace("SessionStart", "FakeStart"));
  git(product, ["add", "."]);
  git(product, ["commit", "-qm", "Product edit to managed Hook"]);
  const refused = callRill(["upgrade", product, "--yes"], { mustFail: true });
  assert.match(refused, /Managed file changed/);
  assert.match(readFileSync(hooksPath, "utf8"), /FakeStart/);
});

test("brownfield source, tests and unrelated workflows survive adoption and native rollback", () => {
  const project = join(sandbox, "brownfield");
  mkdirSync(project);
  const original = newProduct(project);
  file(project, ".codex/config.toml", '# Owned by product\nmodel = "other"\n');
  file(project, ".codex/hooks.json", '{ "hooks": { "SessionStart": [] } }\n');
  pinned(["node", "pnpm"], "pnpm", ["--dir", project, "install"]);
  pinned(["node", "pnpm"], "pnpm", ["--dir", project, "exec", "biome", "check", "--write", "src", "tests"]);
  const preserved = ["AGENTS.md", ".codex/config.toml", ".codex/hooks.json", ".github/workflows/existing.yml", "src/server.ts", "README.md", ".gitignore"];
  const before = Object.fromEntries(preserved.map((name) => [name, readFileSync(join(project, name), "utf8")]));
  git(project, ["add", "."]);
  git(project, ["commit", "-qm", "Pre-existing product baseline"]);
  copyStandard(project, { project_name: "Brownfield API", react: false, node: true, python: false, shell: false, node_root: "." });
  verifySingleRunner(project);
  verifyJustfile(project, ["run test:unit", "run test:integration", "run test:coverage"]);
  for (const name of preserved) assert.equal(readFileSync(join(project, name), "utf8"), before[name], name);
  pinned(["node", "pnpm"], "pnpm", ["--dir", project, "install", "--frozen-lockfile"]);
  execute("just", ["ci"], { cwd: project });
  const source = join(project, "src/server.ts");
  const healthy = readFileSync(source, "utf8");
  writeFileSync(source, healthy.replace("return left + right;", "return left - right;"));
  execute("just", ["ci"], { cwd: project, mustFail: true });
  writeFileSync(source, healthy);
  execute("just", ["ci"], { cwd: project });
  const baseline = git(project, ["rev-parse", "HEAD"]);
  git(project, ["add", "."]);
  git(project, ["commit", "-qm", "Adopt Rill without changing product"]);
  const adopted = git(project, ["rev-parse", "HEAD"]);
  assert.notEqual(adopted, baseline);
  git(project, ["revert", "--no-edit", adopted]);
  assert.equal(git(project, ["diff", baseline, "--name-only"]), "");
  assert.equal(git(project, ["status", "--porcelain"]), "");
});

test("Git history scan ignores project-supplied secret rule overrides", () => {
  const project = join(sandbox, "neutral-secret-scan");
  newProduct(project);
  git(project, ["add", "."]);
  git(project, ["commit", "-qm", "Harmless baseline"]);
  file(project, "local-test-token.txt", 'key = "ghp_' + "Ak5b7Cd2Ef9Gh4Jk1Lm8Np3Qr6St0Uv2Wx5Z" + '"\n');
  git(project, ["add", "local-test-token.txt"]);
  git(project, ["commit", "-qm", "Synthetic test token"]);
  file(project, ".gitleaks.toml", 'title = "Inert local rules"\n[[rules]]\nid = "ignore-all"\nregex = "NO_MATCH"\n');
  copyStandard(project, { project_name: "Security check", react: false, node: true, python: false, shell: false, node_root: "." });
  verifySingleRunner(project);
  const neutral = mkdtempSync(join(tmpdir(), "rill-neutral-gitleaks-"));
  try {
    pinned(["gitleaks"], "gitleaks", ["git", "--redact", "--exit-code", "1", "--gitleaks-ignore-path=/dev/null", "--ignore-gitleaks-allow"], {
      cwd: neutral,
      mustFail: true,
      env: { GIT_DIR: join(project, ".git"), GIT_WORK_TREE: project, GITLEAKS_CONFIG: "" },
    });
  } finally { rmSync(neutral, { recursive: true, force: true }); }
});

test("missing Copier source fails without mutating an enrolled product", () => {
  const project = join(sandbox, "missing-upstream");
  const source = join(sandbox, "isolated-upstream");
  const hiddenSource = join(sandbox, "isolated-upstream-unavailable");
  const original = newProduct(project);
  git(project, ["add", "."]);
  git(project, ["commit", "-qm", "Independent product baseline"]);
  cpSync(template, source, { recursive: true });
  pinned(["pypi:copier"], "copier", [
    "copy",
    "--defaults",
    "--vcs-ref",
    "v0.1.0",
    "-d",
    "preserve_agent_entry=true",
    "-d",
    "react=false",
    "-d",
    "node=true",
    "-d",
    "python=false",
    "-d",
    "shell=false",
    "-d",
    "node_root=.",
    source,
    project,
  ]);
  git(project, ["add", "."]);
  git(project, ["commit", "-qm", "Enroll offline-safe product"]);
  const before = git(project, ["rev-parse", "HEAD"]);
  renameSync(source, hiddenSource);
  try {
    pinned(
      ["pypi:copier"],
      "copier",
      [
        "update",
        "--defaults",
        "--answers-file",
        ".rill/copier-answers.yml",
        "--vcs-ref",
        "v0.2.0",
        project,
      ],
      { mustFail: true },
    );
  } finally {
    renameSync(hiddenSource, source);
  }
  assert.equal(git(project, ["status", "--porcelain"]), "");
  assert.equal(git(project, ["rev-parse", "HEAD"]), before);
  assert.equal(
    readFileSync(join(project, "AGENTS.md"), "utf8"),
    original["AGENTS.md"],
  );
});

test("independent Python/Shell project executes actual source gates and rejects broken behavior", () => {
  const project = join(sandbox, "new-python-shell");
  cpSync(join(repository, "tests/fixtures/independent-python-shell"), project, { recursive: true });
  git(project, ["init", "-q", "-b", "main"]);
  copyStandard(project, { project_name: "Python Shell", react: false, node: false, python: true, shell: true, python_root: "services/python" });
  verifySingleRunner(project);
  verifyJustfile(project, ["uv --directory", "ruff", "pytest", "bats"]);
  // CI receipts require an actual initial revision, not an unborn Git HEAD.
  execute("just", ["ci"], { cwd: project, mustFail: true });
  git(project, ["add", "."]);
  git(project, ["commit", "-qm", "Initialize independent Python/Shell product"]);
  execute("just", ["setup-ci"], { cwd: project });
  execute("just", ["ci"], { cwd: project });
  const source = join(project, "services/python/src/independent_service/core.py");
  const content = readFileSync(source, "utf8");
  writeFileSync(source, "def broken(:\n");
  execute("just", ["ci"], { cwd: project, mustFail: true });
  writeFileSync(source, content);
  const shell = join(project, "scripts/health.sh");
  const shellContent = readFileSync(shell, "utf8");
  writeFileSync(shell, "#!/usr/bin/env bash\nif\n");
  execute("just", ["ci"], { cwd: project, mustFail: true });
  writeFileSync(shell, shellContent);
  execute("just", ["ci"], { cwd: project });
});

test("browser gates are local-only and fail rather than falsely pass without real tests", () => {
  const project = join(sandbox, "browser-proof");
  mkdirSync(project);
  copyStandard(project, { project_name: "Browser product", react: true, node: false, python: false, shell: false, react_root: "." });
  const workflow = verifySingleRunner(project);
  assert.doesNotMatch(workflow, /playwright (?:install|test)|chromium install|ci-full/i);
  const justfile = verifyJustfile(project, ["ci-full:", "run test:e2e", "run test:a11y"]);
  assert.match(justfile, /just ci/);
  assert.match(justfile.slice(justfile.indexOf("ci:"), justfile.indexOf("ci-full:")), /gitleaks git/);
  assert.doesNotMatch(justfile.slice(justfile.indexOf("ci:"), justfile.indexOf("ci-full:")), /test:e2e|test:a11y/);
  execute("just", ["ci-full"], { cwd: project, mustFail: true });
});

test("independent React/Tailwind project executes actual Chrome/UI and CI source gates", () => {
  const project = join(sandbox, "new-react");
  cpSync(join(repository, "tests/fixtures/independent-react"), project, {
    recursive: true,
    filter: (path) => !path.split("/").some((segment) => ["node_modules", "dist", "coverage", "test-results", "playwright-report"].includes(segment)),
  });
  const manifest = readFileSync(join(project, "package.json"), "utf8");
  const componentPath = join(project, "src/Counter.tsx");
  const source = readFileSync(componentPath, "utf8");
  git(project, ["init", "-q", "-b", "main"]);
  git(project, ["add", "."]);
  git(project, ["commit", "-qm", "Existing React product"]);
  copyStandard(project, { project_name: "React product", react: true, node: false, python: false, shell: false, react_root: ".", react_coverage: 75 });
  verifySingleRunner(project);
  verifyJustfile(project, ["run test:unit", "run test:integration", "run test:coverage", "run test:e2e", "run test:a11y"]);
  assert.equal(readFileSync(join(project, "package.json"), "utf8"), manifest);
  pinned(["node", "pnpm"], "pnpm", ["--dir", project, "install", "--frozen-lockfile"]);
  execute("just", ["ci"], { cwd: project });
  execute("just", ["ci-full"], { cwd: project });
  writeFileSync(componentPath, 'export default function Counter() { throw new Error("Intentional broken product"); }\n');
  execute("just", ["ci"], { cwd: project, mustFail: true });
  writeFileSync(componentPath, source);
  execute("just", ["ci"], { cwd: project });
});

test("PR checks use one runner and release is tag-only on supported platforms", () => {
  const quality = readFileSync(join(repository, ".github/workflows/quality.yml"), "utf8");
  const release = readFileSync(join(repository, ".github/workflows/release-rill.yml"), "utf8");
  const jobs = quality.slice(quality.indexOf("\njobs:\n") + 7);
  assert.deepEqual([...jobs.matchAll(/^ {2}([a-z][\w-]*):$/gm)].map((match) => match[1]), ["quality"]);
  assert.match(quality, /runs-on: ubuntu-latest/);
  assert.match(quality, /cancel-in-progress: true/);
  assert.match(quality, /draft == false/);
  assert.match(quality, /paths-ignore:/);
  assert.match(quality, /just setup-ci/);
  assert.match(quality, /just ci/);
  assert.doesNotMatch(quality, /ci-full|playwright install/);
  const trigger = release.slice(release.indexOf("\non:\n") + 1, release.indexOf("\nconcurrency:\n"));
  assert.match(trigger, /push:\n    tags: \['v\*'\]/);
  assert.doesNotMatch(trigger, /pull_request:|branches:|workflow_dispatch:/);
  const platforms = [...release.matchAll(/- \{os: ([^,]+), platform: ([^}]+)\}/g)].map((match) => [match[1], match[2]]);
  assert.deepEqual(platforms, [
    ["ubuntu-24.04", "linux-x64"],
    ["ubuntu-24.04-arm", "linux-arm64"],
    ["macos-26", "macos-arm64"],
  ]);
  assert.doesNotMatch(readFileSync(join(repository, "mise.lock"), "utf8"), /platforms\.macos-x64/);
});
