import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
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
    preserve_agent_entry: existsSync(join(destination, "AGENTS.md")),
    preserve_codex_roles:
      existsSync(join(destination, ".codex/config.toml")) ||
      existsSync(join(destination, ".codex/agents/reviewer.toml")),
    preserve_hook_config:
      existsSync(join(destination, ".codex/hooks.json")) ||
      existsSync(join(destination, ".codex/hooks/rill.py")),
    preserve_rill_skills: existsSync(
      join(destination, ".agents/skills/rill-adopt/SKILL.md"),
    ),
  };
  const args = [
    "copy",
    "--defaults",
    "--vcs-ref",
    "v0.1.0",
    ...Object.entries({ ...detectedOwnership, ...answers }).flatMap(
      ([key, value]) => ["--data", key + "=" + value],
    ),
    template,
    destination,
  ];
  return pinned(["pypi:copier"], "copier", args);
}

function invokeDistributedHook(project, mode, event = {}, env = {}) {
  const executable = join(project, ".codex/hooks/rill.py");
  const result = spawnSync("python3", [executable, mode], {
    cwd: project,
    input: JSON.stringify({ cwd: project, ...event }),
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function verifyWorkflow(destination) {
  const generated = join(destination, ".github/workflows/rill-quality.yml");
  pinned(["aqua:rhysd/actionlint"], "actionlint", [generated]);
  return readFileSync(generated, "utf8");
}

const pinnedNodeDirectory = dirname(
  execute("mise", ["-C", repository, "which", "node"]).trim(),
);

function executeGeneratedStep(workflow, label, cwd, options = {}) {
  const section = workflow.split("      - name: " + label + "\n")[1];
  assert.ok(section, "Missing generated step: " + label);
  const body = section.split(/\n {6}- name:|\n {2}[a-z][\w-]*:/)[0];
  const multiline = body.match(/run: \|\n([\s\S]*)/);
  const singleLine = body.match(/run: (.+)/);
  assert.ok(multiline || singleLine, "No executable source gate: " + label);
  const script = multiline
    ? multiline[1]
        .split("\n")
        .map((line) => (line.startsWith("          ") ? line.slice(10) : line))
        .join("\n")
    : singleLine[1];
  // Run the generated command with the repository's *locked* Node/pnpm
  // versions; a newer system Node may accept flags unavailable in CI.
  // Mise resolves tools from Rill's lockfile, then Bash returns to the
  // isolated product directory before evaluating the generated step.
  // A positional argument avoids interpolating a path into shell source.
  return pinned(
    ["node", "pnpm"],
    "bash",
    ["-e", "-c", 'cd "$1"\n' + script, "rill-step", cwd],
    {
      ...options,
      env: {
        ...options.env,
        PATH: pinnedNodeDirectory + ":" + process.env.PATH,
      },
    },
  );
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
  mkdirSync(join(template, "standards"), { recursive: true });
  cpSync(join(repository, "copier.yml"), join(template, "copier.yml"));
  cpSync(
    join(repository, "standards/template"),
    join(template, "standards/template"),
    { recursive: true },
  );
  git(template, ["init", "-q", "-b", "main"]);
  git(template, ["add", "."]);
  git(template, ["commit", "-qm", "Versioned Rill profile template"]);
  git(template, ["tag", "v0.1.0"]);
});

after(() => {
  if (sandbox) rmSync(sandbox, { recursive: true, force: true });
});

test("one-command Rill adoption inspects native ownership and applies reviewed source", () => {
  const project = join(sandbox, "one-command-consumer");
  mkdirSync(project);
  const args = [
    join(repository, "tools/adopt_rill.py"),
    project,
    "--source",
    template,
    "--ref",
    "v0.1.0",
    "--data",
    "project_name=One Command Consumer",
  ];
  const plan = JSON.parse(execute("python3", args));
  assert.equal(plan.status, "READY_TO_APPLY");
  assert.equal(plan.existing_native_ownership.preserve_agent_entry, false);
  assert.equal(plan.existing_native_ownership.preserve_codex_roles, false);
  const denied = execute(
    "python3",
    [...args, "--data", "preserve_codex_roles=false"],
    {
      mustFail: true,
    },
  );
  assert.match(denied, /Invalid or reserved Copier/);
  const installed = execute("python3", [...args, "--apply"]);
  assert.match(installed, /COPIED_NOT_VERIFIED/);
  assert.ok(existsSync(join(project, ".codex/agents/worker.toml")));
  assert.ok(existsSync(join(project, ".agents/skills/rill-review/SKILL.md")));
  const sibling = join(sandbox, "relative-source-consumer");
  mkdirSync(sibling);
  const relativeArgs = [
    join(repository, "tools/adopt_rill.py"),
    sibling,
    "--source",
    "template",
    "--ref",
    "v0.1.0",
  ];
  const relativePlan = JSON.parse(
    execute("python3", relativeArgs, { cwd: sandbox }),
  );
  assert.equal(relativePlan.source, template);
  execute("python3", [...relativeArgs, "--apply"], { cwd: sandbox });
  assert.ok(existsSync(join(sibling, ".codex/hooks.json")));
  git(project, ["init", "-q", "-b", "main"]);
  git(project, ["add", "."]);
  git(project, ["commit", "-qm", "Versioned Rill adoption"]);
  const status = invokeDistributedHook(project, "status");
  assert.equal(status.status, "BLOCKED");
  assert.match(status.reason, /no configured engineering parent Issue/);
});

test("installer rejects untracked files even with Git untracked reporting disabled", () => {
  const project = join(sandbox, "untracked-consumer");
  newProduct(project);
  git(project, ["add", "."]);
  git(project, ["commit", "-qm", "Product baseline"]);
  file(project, "private-untracked-note.txt", "Do not modify this work.\n");
  const refused = execute(
    "python3",
    [
      join(repository, "tools/adopt_rill.py"),
      project,
      "--source",
      template,
      "--ref",
      "v0.1.0",
      "--apply",
    ],
    {
      mustFail: true,
      env: {
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: "status.showUntrackedFiles",
        GIT_CONFIG_VALUE_0: "no",
      },
    },
  );
  assert.match(refused, /not clean/);
  assert.equal(existsSync(join(project, ".rill/STANDARD.md")), false);
});

test("greenfield four-stack profile has pinned native provenance and valid Actions", () => {
  const project = join(sandbox, "greenfield");
  mkdirSync(project);
  copyStandard(project, { project_name: "New Product" });
  const receipt = readFileSync(
    join(project, ".rill/copier-answers.yml"),
    "utf8",
  );
  assert.match(receipt, /_commit: v0.1.0/);
  assert.match(receipt, /_src_path:/);
  assert.match(
    readFileSync(join(project, ".rill/STANDARD.md"), "utf8"),
    /NOT ENROLLED/,
  );
  for (const path of [
    "AGENTS.md",
    ".codex/config.toml",
    ".codex/hooks.json",
    ".codex/hooks/rill.py",
    ".codex/agents/worker.toml",
    ".codex/agents/reviewer.toml",
    ".agents/skills/rill-adopt/SKILL.md",
    ".agents/skills/rill-deliver/SKILL.md",
    ".agents/skills/rill-review/SKILL.md",
    ".agents/skills/rill-recover/SKILL.md",
  ]) {
    assert.ok(
      existsSync(join(project, path)),
      "Missing factory capability " + path,
    );
  }
  const nativeConfig = readFileSync(
    join(project, ".codex/config.toml"),
    "utf8",
  );
  assert.match(nativeConfig, /mcp_servers.openaiDeveloperDocs/);
  assert.match(
    nativeConfig,
    /\[plugins\."rill@rill-local"\]\s*enabled = false/,
  );
  const hooks = JSON.parse(
    readFileSync(join(project, ".codex/hooks.json"), "utf8"),
  );
  for (const event of [
    "SessionStart",
    "PostToolUse",
    "SubagentStart",
    "Stop",
  ]) {
    assert.ok(hooks.hooks[event], "Missing native event " + event);
  }
  const workflow = verifyWorkflow(project);
  for (const job of ["typescript", "python", "shell", "security"]) {
    assert.match(workflow, new RegExp("^  " + job + ":", "m"));
  }
  for (const gate of [
    "Execute native Vitest source coverage",
    "Execute native Chrome E2E test cases",
    "Execute native Chrome accessibility test cases",
    "Execute native Node test runner with full-source coverage",
    "ruff check",
    "mypy --strict",
    "bats --tap",
    "gitleaks git",
    "trivy fs",
  ]) {
    assert.ok(workflow.includes(gate), gate + " is missing");
  }
  for (const gate of [
    "Verify tracked React application and test source",
    "Execute native Vitest source coverage",
    "Execute native Chrome E2E test cases",
    "Execute native Chrome accessibility test cases",
    "Verify tracked Node application and test source",
    "Execute native Node test runner with full-source coverage",
  ]) {
    assert.ok(
      workflow.includes(gate),
      "Absent product-source verification: " + gate,
    );
  }
  for (const job of ["typescript", "python", "shell"]) {
    assert.match(workflow, new RegExp("  " + job + ":\\n    needs: security"));
  }
  assert.ok(!existsSync(join(project, "package.json")));
  executeGeneratedStep(
    workflow,
    "Verify tracked React application and test source",
    project,
    { mustFail: true },
  );
  pinned(["node", "pnpm"], "pnpm", ["--dir", project, "run", "test:coverage"], {
    mustFail: true,
  });
});

test("nested pnpm projects use repository-relative action inputs and merge-queue checks", () => {
  const project = join(sandbox, "nested-pnpm-workspace");
  mkdirSync(project);
  copyStandard(project, {
    project_name: "Nested React",
    react: true,
    node: false,
    python: false,
    shell: false,
    js_workspace: "frontend",
    react_root: ".",
  });
  assert.ok(!existsSync(join(project, "package.json")));
  const workflow = verifyWorkflow(project);
  assert.match(workflow, /^ {2}merge_group:/m);
  assert.match(workflow, /package_json_file: "frontend\/package\.json"/);
  assert.match(workflow, /cache-dependency-path: "frontend\/pnpm-lock\.yaml"/);
  assert.match(workflow, /working-directory: "frontend"/);
  assert.equal(
    workflow.match(/package_json_file: "frontend\/package\.json"/g)?.length,
    2,
  );
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

test("native Node Vitest profile is selected without trusting package scripts", () => {
  const project = join(sandbox, "node-vitest-profile");
  mkdirSync(project);
  copyStandard(project, {
    node: true,
    react: false,
    python: false,
    shell: false,
    node_root: ".",
    node_test_runner: "vitest",
  });
  const workflow = verifyWorkflow(project);
  assert.match(workflow, /Execute native Vitest source coverage for Node/);
  assert.doesNotMatch(
    workflow,
    /Execute native Node test runner with full-source coverage/,
  );
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

test("installed native Hook uses Git facts and bounds continuation", () => {
  const project = join(sandbox, "hook-consumer");
  mkdirSync(project);
  newProduct(project);
  git(project, ["add", "."]);
  git(project, ["commit", "-qm", "Baseline"]);
  copyStandard(project, {
    project_name: "Hook Consumer",
    react: false,
    node: true,
    python: false,
    shell: false,
    node_root: ".",
  });
  // Existing product AGENTS.md is not overwritten and does not
  // magically become a verified Rill runtime.
  const state = invokeDistributedHook(project, "status");
  assert.equal(state.status, "BLOCKED");
  assert.match(state.reason, /AGENTS.md requires reviewed Rill integration/);
  const ownAgentEntry = readFileSync(join(project, "AGENTS.md"), "utf8");
  writeFileSync(
    join(project, "AGENTS.md"),
    "# Hook Consumer — Rill Agent Entry\n",
  );
  const rolePath = join(project, ".codex/agents/reviewer.toml");
  const originalRole = readFileSync(rolePath, "utf8");
  writeFileSync(
    rolePath,
    originalRole.replace('model = "gpt-6.2-sol"', 'model = ""'),
  );
  const invalidRole = invokeDistributedHook(project, "status");
  assert.equal(invalidRole.status, "BLOCKED");
  assert.match(invalidRole.reason, /lacks model/);
  writeFileSync(rolePath, originalRole);
  const hooksPath = join(project, ".codex/hooks.json");
  const originalHooks = readFileSync(hooksPath, "utf8");
  const hooksWithoutTool = JSON.parse(originalHooks);
  delete hooksWithoutTool.hooks.PostToolUse;
  writeFileSync(hooksPath, JSON.stringify(hooksWithoutTool));
  const invalidHooks = invokeDistributedHook(project, "status");
  assert.equal(invalidHooks.status, "BLOCKED");
  assert.match(invalidHooks.reason, /PostToolUse/);
  writeFileSync(hooksPath, "[]");
  const malformedHooks = invokeDistributedHook(project, "status");
  assert.equal(malformedHooks.status, "BLOCKED");
  assert.match(malformedHooks.reason, /Invalid native Codex config or Hook/);
  writeFileSync(
    hooksPath,
    JSON.stringify({ hooks: { SessionStart: [{ hooks: null }] } }),
  );
  const invalidHandler = invokeDistributedHook(project, "status");
  assert.equal(invalidHandler.status, "BLOCKED");
  assert.match(invalidHandler.reason, /Missing Rill command handler/);
  writeFileSync(hooksPath, originalHooks);
  const mismatched = JSON.parse(originalHooks);
  mismatched.hooks.Stop[0].hooks[0].command =
    mismatched.hooks.Stop[0].hooks[0].command.replace(" stop", " check");
  writeFileSync(hooksPath, JSON.stringify(mismatched));
  const wrongStop = invokeDistributedHook(project, "status");
  assert.equal(wrongStop.status, "BLOCKED");
  assert.match(wrongStop.reason, /Missing Rill command handler: Stop/);
  mismatched.hooks.Stop[0].hooks[0].command = null;
  writeFileSync(hooksPath, JSON.stringify(mismatched));
  const nullHandler = invokeDistributedHook(project, "status");
  assert.equal(nullHandler.status, "BLOCKED");
  assert.match(nullHandler.reason, /Missing Rill command handler: Stop/);
  writeFileSync(hooksPath, originalHooks);
  const unbound = invokeDistributedHook(project, "status");
  assert.equal(unbound.status, "BLOCKED");
  assert.match(unbound.reason, /no configured engineering parent Issue/);
  writeFileSync(join(project, "AGENTS.md"), ownAgentEntry);
  const started = invokeDistributedHook(project, "start", {
    source: "startup",
  });
  assert.match(started.hookSpecificOutput.additionalContext, /BLOCKED/);
  assert.deepEqual(invokeDistributedHook(project, "stop"), {});
  const source = join(project, "src/server.ts");
  const original = readFileSync(source, "utf8");
  writeFileSync(source, original + "  \n");
  const feedback = invokeDistributedHook(project, "check", {
    tool_name: "apply_patch",
  });
  assert.match(
    feedback.hookSpecificOutput.additionalContext,
    /git diff --check failed/,
  );
  const continued = invokeDistributedHook(project, "stop");
  assert.equal(continued.decision, "block");
  git(project, ["add", "src/server.ts"]);
  const stagedFailure = invokeDistributedHook(project, "stop");
  assert.equal(stagedFailure.decision, "block");
  const stagedToolFeedback = invokeDistributedHook(project, "check");
  assert.match(
    stagedToolFeedback.hookSpecificOutput.additionalContext,
    /git diff --check failed/,
  );
  git(project, ["restore", "--staged", "src/server.ts"]);
  assert.deepEqual(
    invokeDistributedHook(project, "stop", { stop_hook_active: true }),
    {},
  );
  writeFileSync(source, original);
  assert.deepEqual(invokeDistributedHook(project, "stop"), {});
  const brokenIndex = join(sandbox, "invalid-git-index");
  writeFileSync(brokenIndex, "Invalid git index\n");
  const unavailable = invokeDistributedHook(
    project,
    "stop",
    {},
    {
      GIT_INDEX_FILE: brokenIndex,
    },
  );
  assert.match(unavailable.systemMessage, /unavailable/);
  const delegated = invokeDistributedHook(project, "subagent", {
    agent_type: "reviewer",
  });
  assert.match(delegated.hookSpecificOutput.additionalContext, /reviewer/);
});

test("native recovery binds issues to the checkout origin, not GH_REPO override", () => {
  const project = join(sandbox, "origin-bound-consumer");
  mkdirSync(project);
  copyStandard(project, {
    project_name: "Origin Bound",
    github_parent_issue: 22,
    react: false,
    node: true,
    python: false,
    shell: false,
    node_root: ".",
  });
  git(project, ["init", "-q", "-b", "main"]);
  git(project, ["add", "."]);
  git(project, ["commit", "-qm", "Install Rill"]);
  const withoutRemote = invokeDistributedHook(project, "status");
  assert.equal(withoutRemote.status, "BLOCKED");
  assert.match(withoutRemote.reason, /Git origin/);
  git(project, [
    "remote",
    "add",
    "origin",
    "https://github.com/acme/target.git",
  ]);
  const bin = join(sandbox, "mock-gh");
  mkdirSync(bin);
  const ghScript = join(bin, "gh");
  writeFileSync(
    ghScript,
    `#!/bin/sh
if [ "$1" = repo ] && [ "$2" = view ] && [ "$3" = "https://github.com/acme/target.git" ]; then
  echo "acme/target"
elif [ "$1" = issue ] && [ "$2" = view ] && [ "$3" = 22 ] && [ "$4" = "-R" ] && [ "$5" = "acme/target" ]; then
  echo '{"number":22,"state":"OPEN","title":"Active delivery","url":"https://github.com/acme/target/issues/22"}'
else
  exit 1
fi
`,
  );
  chmodSync(ghScript, 0o700);
  const bound = invokeDistributedHook(
    project,
    "status",
    {},
    {
      GH_REPO: "acme/wrong",
      PATH: bin + ":" + process.env.PATH,
    },
  );
  assert.equal(bound.status, "BOUND");
  assert.equal(bound.repository, "acme/target");
  assert.equal(bound.issue.number, 22);
});

test("legacy Copier upgrade preserves consumer-owned native settings on new defaults", () => {
  const source = join(sandbox, "legacy-template-source");
  mkdirSync(source);
  cpSync(
    join(repository, "standards/template"),
    join(source, "standards/template"),
    {
      recursive: true,
    },
  );
  const currentYaml = readFileSync(join(repository, "copier.yml"), "utf8");
  const start = currentYaml.indexOf("_skip_if_exists:");
  const end = currentYaml.indexOf("_envops:");
  const questions = currentYaml.indexOf("# Deterministic preflight values");
  const projectQuestion = currentYaml.indexOf("project_name:");
  assert.ok(start > 0 && end > start && projectQuestion > questions);
  const legacyYaml =
    currentYaml.slice(0, start) +
    currentYaml.slice(end, questions) +
    currentYaml.slice(projectQuestion);
  file(source, "copier.yml", legacyYaml);
  rmSync(join(source, "standards/template/.codex"), {
    recursive: true,
    force: true,
  });
  rmSync(join(source, "standards/template/.agents"), {
    recursive: true,
    force: true,
  });
  rmSync(join(source, "standards/template/AGENTS.md.jinja"));
  git(source, ["init", "-q", "-b", "main"]);
  git(source, ["add", "."]);
  git(source, [
    "commit",
    "-qm",
    "Prior Rill standard without native distribution",
  ]);
  git(source, ["tag", "v0.1.0"]);

  const project = join(sandbox, "legacy-consumer");
  newProduct(project);
  const ownAgent = readFileSync(join(project, "AGENTS.md"), "utf8");
  file(
    project,
    ".codex/config.toml",
    '# Existing product native config\nmodel = "other"\n',
  );
  file(project, ".codex/hooks.json", '{"hooks":{"SessionStart":[]}}\n');
  file(
    project,
    ".codex/agents/reviewer.toml",
    '# Existing native reviewer\nname = "reviewer"\n',
  );
  const ownedFiles = [
    "AGENTS.md",
    ".codex/config.toml",
    ".codex/hooks.json",
    ".codex/agents/reviewer.toml",
  ];
  const originals = Object.fromEntries(
    ownedFiles.map((name) => [name, readFileSync(join(project, name), "utf8")]),
  );
  git(project, ["add", "."]);
  git(project, ["commit", "-qm", "Existing app configuration"]);
  pinned(["pypi:copier"], "copier", [
    "copy",
    "--defaults",
    "--vcs-ref",
    "v0.1.0",
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
  git(project, ["commit", "-qm", "Install previous Rill standard"]);
  file(source, "copier.yml", currentYaml);
  cpSync(
    join(repository, "standards/template"),
    join(source, "standards/template"),
    {
      recursive: true,
    },
  );
  git(source, ["add", "."]);
  git(source, ["commit", "-qm", "Introduce factory runtime distribution"]);
  git(source, ["tag", "v0.2.0"]);

  pinned(["pypi:copier"], "copier", [
    "update",
    "--defaults",
    "--answers-file",
    ".rill/copier-answers.yml",
    "--vcs-ref",
    "v0.2.0",
    project,
  ]);
  for (const [name, content] of Object.entries(originals)) {
    assert.equal(readFileSync(join(project, name), "utf8"), content, name);
  }
  assert.equal(readFileSync(join(project, "AGENTS.md"), "utf8"), ownAgent);
  assert.ok(existsSync(join(project, ".agents/skills/rill-review/SKILL.md")));
  assert.ok(existsSync(join(project, ".codex/agents/worker.toml")));
  const receipt = readFileSync(
    join(project, ".rill/copier-answers.yml"),
    "utf8",
  );
  assert.match(receipt, /_commit: v0.2.0/);
});

test("brownfield source, tests and unrelated workflows survive adoption and native rollback", () => {
  const project = join(sandbox, "brownfield");
  mkdirSync(project);
  const original = newProduct(project);
  file(
    project,
    ".codex/config.toml",
    '# Product-owned Codex config\nmodel = "other"\n',
  );
  file(project, ".codex/hooks.json", '{ "hooks": { "SessionStart": [] } }\n');
  file(
    project,
    ".codex/agents/reviewer.toml",
    '# Product-owned reviewer\nname = "reviewer"\n',
  );
  pinned(["node", "pnpm"], "pnpm", ["--dir", project, "install"]);
  pinned(["node", "pnpm"], "pnpm", [
    "--dir",
    project,
    "exec",
    "biome",
    "check",
    "--write",
    "src",
    "tests",
  ]);
  git(project, ["add", "."]);
  git(project, ["commit", "-qm", "Existing product baseline"]);
  const originalPaths = [
    "AGENTS.md",
    ".codex/config.toml",
    ".codex/hooks.json",
    ".codex/agents/reviewer.toml",
    "README.md",
    "docs/product.md",
    ".github/workflows/existing.yml",
    "src/server.ts",
  ];
  const before = Object.fromEntries(
    originalPaths.map((name) => [
      name,
      readFileSync(join(project, name), "utf8"),
    ]),
  );

  copyStandard(project, {
    project_name: "Existing API",
    react: false,
    node: true,
    python: false,
    shell: false,
    node_root: ".",
  });
  const workflow = verifyWorkflow(project);
  assert.match(
    readFileSync(join(project, ".rill/STANDARD.md"), "utf8"),
    /NOT ENROLLED/,
  );
  assert.match(workflow, /^ {2}typescript:/m);
  assert.doesNotMatch(workflow, /^ {2}python:/m);
  assert.doesNotMatch(workflow, /^ {2}shell:/m);
  assert.match(workflow, /^ {2}security:/m);
  assert.equal(git(project, ["diff", "--name-only"]), "");
  for (const name of originalPaths) {
    assert.equal(readFileSync(join(project, name), "utf8"), before[name], name);
  }

  pinned(["node", "pnpm"], "pnpm", [
    "--dir",
    project,
    "install",
    "--frozen-lockfile",
  ]);
  for (const gate of [
    "lint",
    "typecheck",
    "test:unit",
    "test:integration",
    "test:coverage",
    "build",
  ]) {
    const output = pinned(["node", "pnpm"], "pnpm", [
      "--dir",
      project,
      "run",
      gate,
    ]);
    if (gate.startsWith("test:")) assert.match(output, /pass [1-9]/);
  }
  executeGeneratedStep(
    workflow,
    "Verify tracked Node application and test source",
    project,
  );
  executeGeneratedStep(
    workflow,
    "Execute native Node test runner with full-source coverage",
    project,
  );

  const nativeDefaultTest = join(project, "test/regression.mjs");
  mkdirSync(dirname(nativeDefaultTest), { recursive: true });
  writeFileSync(
    nativeDefaultTest,
    'import { test } from "node:test";\ntest("native default discovery regression", () => { throw new Error("Default-discovered regression must block coverage"); });\n',
  );
  git(project, ["add", "test/regression.mjs"]);
  executeGeneratedStep(
    workflow,
    "Execute native Node test runner with full-source coverage",
    project,
    { mustFail: true },
  );
  rmSync(nativeDefaultTest);
  git(project, ["reset", "--", "test/regression.mjs"]);
  const specOnlyModule = join(project, "src/spec-only.ts");
  const specOnlyTest = join(project, "tests/spec.integration.spec.ts");
  writeFileSync(
    specOnlyModule,
    "export function specOnly(): number { return 17; }\n",
  );
  writeFileSync(
    specOnlyTest,
    'import { test } from "node:test";\nimport { strict as assert } from "node:assert";\nimport { specOnly } from "../src/spec-only.ts";\ntest("runs integration spec by explicit native inventory", () => assert.equal(specOnly(), 17));\n',
  );
  git(project, ["add", "src/spec-only.ts", "tests/spec.integration.spec.ts"]);
  executeGeneratedStep(
    workflow,
    "Execute native Node test runner with full-source coverage",
    project,
  );
  rmSync(specOnlyModule);
  rmSync(specOnlyTest);
  git(project, [
    "reset",
    "--",
    "src/spec-only.ts",
    "tests/spec.integration.spec.ts",
  ]);

  executeGeneratedStep(
    workflow,
    "Node security and correctness lint with Oxlint",
    project,
  );
  executeGeneratedStep(workflow, "Node source complexity with Lizard", project);
  const badNodeSource = join(project, "src/complexity-failure.ts");
  writeFileSync(
    badNodeSource,
    [
      "export function bad(value: number): number {",
      ...Array.from(
        { length: 23 },
        (_, index) => "if (value === " + index + ") return " + index + ";",
      ),
      "return -1;",
      "}",
      "",
    ].join("\n"),
  );
  git(project, ["add", "src/complexity-failure.ts"]);
  executeGeneratedStep(
    workflow,
    "Node source complexity with Lizard",
    project,
    { mustFail: true },
  );
  rmSync(badNodeSource);
  git(project, ["reset", "--", "src/complexity-failure.ts"]);
  const alternateModule = join(project, "src/complexity-failure.mts");
  writeFileSync(
    alternateModule,
    [
      "export function bad(value: number): number {",
      ...Array.from(
        { length: 23 },
        (_, index) => "if (value === " + index + ") return " + index + ";",
      ),
      "return -1;",
      "}",
      "",
    ].join("\n"),
  );
  git(project, ["add", "src/complexity-failure.mts"]);
  executeGeneratedStep(
    workflow,
    "Node security and correctness lint with Oxlint",
    project,
    { mustFail: true },
  );
  rmSync(alternateModule);
  git(project, ["reset", "--", "src/complexity-failure.mts"]);
  executeGeneratedStep(workflow, "Execute actual Node unit tests", project);
  const nodeUnitFile = join(project, "tests/unit.test.ts");
  const nodeUnitSource = readFileSync(nodeUnitFile, "utf8");
  writeFileSync(nodeUnitFile, nodeUnitSource.replaceAll("test(", "test.skip("));
  executeGeneratedStep(workflow, "Execute actual Node unit tests", project, {
    mustFail: true,
  });
  writeFileSync(nodeUnitFile, nodeUnitSource);
  assert.match(nodeUnitSource, /test\("/);
  writeFileSync(
    nodeUnitFile,
    nodeUnitSource.replace(
      /test\("[^"]+"/,
      'test("loads fixtures/parser.test.js"',
    ),
  );
  executeGeneratedStep(workflow, "Execute actual Node unit tests", project);
  writeFileSync(nodeUnitFile, nodeUnitSource);
  executeGeneratedStep(
    workflow,
    "Execute actual Node integration tests",
    project,
  );
  const nodeIntegrationFile = join(project, "tests/integration/health.test.ts");
  const nodeIntegrationSource = readFileSync(nodeIntegrationFile, "utf8");
  writeFileSync(
    nodeIntegrationFile,
    nodeIntegrationSource.replace(
      'test("HTTP health',
      'test.skip("HTTP health',
    ),
  );
  executeGeneratedStep(
    workflow,
    "Execute actual Node integration tests",
    project,
    { mustFail: true },
  );
  writeFileSync(nodeIntegrationFile, nodeIntegrationSource);
  writeFileSync(
    nodeIntegrationFile,
    "export const noRegisteredCases = true;\n",
  );
  executeGeneratedStep(
    workflow,
    "Execute actual Node integration tests",
    project,
    { mustFail: true },
  );
  writeFileSync(nodeIntegrationFile, nodeIntegrationSource);

  const unloaded = join(project, "src/unloaded.ts");
  writeFileSync(
    unloaded,
    "export function untested(): number { return 42; }\n",
  );
  executeGeneratedStep(
    workflow,
    "Execute native Node test runner with full-source coverage",
    project,
    { mustFail: true },
  );
  const maliciousCoverage = join(project, ".c8rc.json");
  writeFileSync(
    maliciousCoverage,
    JSON.stringify({ exclude: ["src/unloaded.ts"] }),
  );
  executeGeneratedStep(
    workflow,
    "Execute native Node test runner with full-source coverage",
    project,
    { mustFail: true },
  );
  rmSync(maliciousCoverage);
  rmSync(unloaded);
  const sourcePath = join(project, "src/server.ts");
  const healthy = readFileSync(sourcePath, "utf8");
  assert.ok(healthy.includes("return left + right;"));
  writeFileSync(
    sourcePath,
    healthy.replace("return left + right;", "return left - right;"),
  );
  const negative = pinned(
    ["node", "pnpm"],
    "pnpm",
    ["--dir", project, "run", "test:unit"],
    {
      mustFail: true,
    },
  );
  assert.match(negative, /fail [1-9]/);
  const manifest = join(project, "package.json");
  const originalPackage = readFileSync(manifest, "utf8");
  const scripts = JSON.parse(originalPackage);
  scripts.scripts["test:unit"] = "node -e 'process.exit(0)'";
  scripts.scripts["test:coverage"] = "node -e 'process.exit(0)'";
  writeFileSync(manifest, JSON.stringify(scripts, null, 2) + "\n");
  pinned(["node", "pnpm"], "pnpm", ["--dir", project, "run", "test:unit"]);
  executeGeneratedStep(
    workflow,
    "Execute native Node test runner with full-source coverage",
    project,
    { mustFail: true },
  );
  writeFileSync(manifest, originalPackage);
  executeGeneratedStep(workflow, "Node production build", project);
  const emptyBuild = JSON.parse(originalPackage);
  emptyBuild.scripts.build = "node -e 'process.exit(0)'";
  writeFileSync(manifest, JSON.stringify(emptyBuild, null, 2) + "\n");
  executeGeneratedStep(workflow, "Node production build", project, {
    mustFail: true,
  });
  writeFileSync(manifest, originalPackage);
  git(project, ["restore", "--", "src/server.ts"]);
  pinned(["node", "pnpm"], "pnpm", ["--dir", project, "run", "test:unit"]);

  git(project, ["add", "."]);
  git(project, [
    "commit",
    "-qm",
    "Adopt Rill without removing existing quality checks",
  ]);
  const adoptedSha = git(project, ["rev-parse", "HEAD"]);

  const doc = join(template, "standards/template/.rill/STANDARD.md.jinja");
  writeFileSync(
    doc,
    readFileSync(doc, "utf8") +
      "\nVerified upstream update remains transparent.\n",
  );
  const templateWorkflow = join(
    template,
    "standards/template/.github/workflows/rill-quality.yml.jinja",
  );
  const workflowOriginal = readFileSync(templateWorkflow, "utf8");
  assert.match(workflowOriginal, /^name: Rill Quality$/m);
  writeFileSync(
    templateWorkflow,
    workflowOriginal.replace(
      /^name: Rill Quality$/m,
      "name: Rill Quality v0.2.0",
    ),
  );
  git(template, ["add", "."]);
  git(template, ["commit", "-qm", "Revised source standard"]);
  git(template, ["tag", "v0.2.0"]);

  pinned(["pypi:copier"], "copier", [
    "update",
    "--defaults",
    "--answers-file",
    ".rill/copier-answers.yml",
    "--vcs-ref",
    "v0.2.0",
    project,
  ]);
  const updated = readFileSync(
    join(project, ".rill/copier-answers.yml"),
    "utf8",
  );
  assert.match(updated, /_commit: v0.2.0/);
  assert.match(
    readFileSync(join(project, ".rill/STANDARD.md"), "utf8"),
    /Verified upstream update/,
  );
  const changed = git(project, ["diff", "--name-only"])
    .split("\n")
    .filter(Boolean);
  assert.deepEqual(changed.sort(), [
    ".github/workflows/rill-quality.yml",
    ".rill/STANDARD.md",
    ".rill/copier-answers.yml",
  ]);
  assert.match(
    readFileSync(join(project, ".github/workflows/rill-quality.yml"), "utf8"),
    /^name: Rill Quality v0.2.0$/m,
  );
  for (const name of originalPaths) {
    assert.equal(readFileSync(join(project, name), "utf8"), before[name]);
  }
  verifyWorkflow(project);
  assert.equal(
    readdirSync(project).filter((name) => name.endsWith(".rej")).length,
    0,
  );

  git(project, ["add", "."]);
  git(project, ["commit", "-qm", "Update reviewed Rill profile"]);
  const updateSha = git(project, ["rev-parse", "HEAD"]);
  git(project, ["revert", "--no-edit", updateSha]);
  assert.equal(git(project, ["diff", adoptedSha, "--name-only"]), "");
  const rolledBack = readFileSync(
    join(project, ".rill/copier-answers.yml"),
    "utf8",
  );
  assert.match(rolledBack, /_commit: v0.1.0/);
  assert.match(
    readFileSync(join(project, ".github/workflows/rill-quality.yml"), "utf8"),
    /^name: Rill Quality$/m,
  );
  assert.equal(git(project, ["status", "--porcelain"]), "");
  assert.ok(original["AGENTS.md"].includes("Existing native agent rules"));
});

test("Git history scan ignores project-supplied secret rule overrides", () => {
  const project = join(sandbox, "neutral-secret-scan");
  newProduct(project);
  git(project, ["add", "."]);
  git(project, ["commit", "-qm", "Harmless product baseline"]);
  file(
    project,
    "local-test-token.txt",
    'key = "ghp_' + "Ak5b7Cd2Ef9Gh4Jk1Lm8Np3Qr6St0Uv2Wx5Z" + '"\n',
  );
  git(project, ["add", "local-test-token.txt"]);
  git(project, ["commit", "-qm", "Synthetic test token"]);
  file(
    project,
    ".gitleaks.toml",
    'title = "Inert local rules"\n[[rules]]\nid = "ignore-all"\nregex = "NO_MATCH"\n',
  );
  copyStandard(project, {
    project_name: "Source scan policy control",
    react: false,
    node: true,
    node_root: ".",
    python: false,
    shell: false,
  });
  const workflow = verifyWorkflow(project);
  executeGeneratedStep(
    workflow,
    "Scan committed Git history before dependency installation",
    project,
    { mustFail: true, env: { GITHUB_WORKSPACE: project } },
  );
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
  const fixture = join(repository, "tests/fixtures/independent-python-shell");
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) =>
      !path
        .split("/")
        .some((segment) =>
          [
            ".venv",
            "node_modules",
            "dist",
            "coverage",
            "test-results",
            "playwright-report",
          ].includes(segment),
        ),
  });
  const pythonRoot = join(project, "services/python");
  const script = join(project, "scripts/health.sh");
  const bats = join(project, "tests/shell/health.bats");
  const sourcePath = join(pythonRoot, "src/independent_service/core.py");
  const originalPython = readFileSync(sourcePath, "utf8");
  const originalShell = readFileSync(script, "utf8");

  git(project, ["init", "-q", "-b", "main"]);
  copyStandard(project, {
    project_name: "Independent Python and Shell",
    react: false,
    node: false,
    python: true,
    shell: true,
    python_root: "services/python",
  });
  const workflow = verifyWorkflow(project);
  assert.doesNotMatch(workflow, /^ {2}typescript:/m);
  assert.match(workflow, /^ {2}python:/m);
  assert.match(workflow, /^ {2}shell:/m);
  assert.match(workflow, /^ {2}security:/m);
  assert.match(workflow, /working-directory: "services\/python"/);
  assert.match(workflow, /uv sync --locked --dev/);
  assert.match(workflow, /pytest -q --ignore="tests\/integration"/);
  assert.match(workflow, /uv build --no-build-isolation/);
  assert.match(workflow, /pip-licenses --format=json/);
  assert.match(workflow, /--fail-on "GPL;AGPL/);
  assert.doesNotMatch(workflow, /pip-licenses --partial-match/);
  assert.match(workflow, /rill-sbom\.cdx\.json/);
  const supplyChainJob = workflow.slice(workflow.indexOf("  security:"));
  assert.ok(supplyChainJob.indexOf("Scan committed Git history") >= 0);
  assert.ok(supplyChainJob.indexOf("Scan original source and lockfiles") >= 0);
  assert.ok(
    supplyChainJob.indexOf("Scan original source and lockfiles") <
      supplyChainJob.indexOf("Install locked Python dependencies"),
  );
  assert.ok(
    supplyChainJob.indexOf("actions/upload-artifact@") <
      supplyChainJob.indexOf("Block prohibited Python license families"),
  );
  assert.ok(
    supplyChainJob.indexOf("actions/upload-artifact@") <
      supplyChainJob.indexOf(
        "Block forbidden or restricted license classifications",
      ),
  );

  executeGeneratedStep(workflow, "Python real integration", pythonRoot);
  executeGeneratedStep(workflow, "Bats real CLI behavior", project);
  const pythonIntegration = join(
    pythonRoot,
    "tests/integration/test_roundtrip.py",
  );
  const realIntegration = readFileSync(pythonIntegration, "utf8");
  writeFileSync(
    pythonIntegration,
    'import pytest\\n\\n@pytest.mark.skip(reason="negative control")\\ndef test_skipped() -> None:\\n    assert True\\n'.replaceAll(
      "\\n",
      "\n",
    ),
  );
  executeGeneratedStep(workflow, "Python real integration", pythonRoot, {
    mustFail: true,
  });
  writeFileSync(pythonIntegration, realIntegration);
  const realBats = readFileSync(bats, "utf8");
  writeFileSync(
    bats,
    '#!/usr/bin/env bats\n\n@test "skipped" {\n  skip "negative control"\n}\n',
  );
  executeGeneratedStep(workflow, "Bats real CLI behavior", project, {
    mustFail: true,
  });
  writeFileSync(
    bats,
    '#!/usr/bin/env bats\n\n@test "prints # skipped items" {\n  run echo valid\n  [ "$status" -eq 0 ]\n}\n',
  );
  executeGeneratedStep(workflow, "Bats real CLI behavior", project);
  writeFileSync(bats, realBats);

  const shellSourceStep = workflow.match(
    / {6}- name: Shell source static analysis\n {8}shell: bash\n {8}run: \|\n([\s\S]*?)(?= {6}- name: Bats real CLI behavior)/,
  );
  assert.ok(
    shellSourceStep,
    "The Shell scanner must use the same tracked inventory",
  );
  const shellCheckCommand = shellSourceStep[1]
    .split("\n")
    .map((line) => (line.startsWith("          ") ? line.slice(10) : line))
    .join("\n");
  const runShellGate = (options = {}) =>
    execute("bash", ["-e", "-o", "pipefail", "-c", shellCheckCommand], {
      cwd: project,
      ...options,
    });

  const uv = (...args) =>
    pinned(["uv"], "uv", ["--directory", pythonRoot, ...args]);
  uv("sync", "--locked", "--dev");
  git(project, ["add", "."]);
  executeGeneratedStep(
    workflow,
    "Python unit/regression execution",
    pythonRoot,
  );
  executeGeneratedStep(
    workflow,
    "Python complete product source coverage",
    pythonRoot,
  );
  const uncoveredPython = join(
    pythonRoot,
    "src/independent_service/uncovered.py",
  );
  writeFileSync(
    uncoveredPython,
    "def untested() -> str:\n    return 'uncovered'\n",
  );
  git(project, ["add", "services/python/src/independent_service/uncovered.py"]);
  executeGeneratedStep(
    workflow,
    "Python complete product source coverage",
    pythonRoot,
    {
      mustFail: true,
    },
  );
  rmSync(uncoveredPython);
  git(project, [
    "reset",
    "-q",
    "--",
    "services/python/src/independent_service/uncovered.py",
  ]);
  const unitTestPath = join(pythonRoot, "tests/test_core.py");
  const unitTestOriginal = readFileSync(unitTestPath, "utf8");
  writeFileSync(
    unitTestPath,
    "import pytest\n\n@pytest.mark.skip(reason='intentional')\ndef test_no_op() -> None:\n    assert True\n",
  );
  executeGeneratedStep(
    workflow,
    "Python unit/regression execution",
    pythonRoot,
    {
      mustFail: true,
    },
  );
  writeFileSync(unitTestPath, unitTestOriginal);
  executeGeneratedStep(
    workflow,
    "Python unit/regression execution",
    pythonRoot,
  );
  executeGeneratedStep(
    workflow,
    "Python complete product source coverage",
    pythonRoot,
  );
  uv("run", "--locked", "ruff", "check", "src", "tests");
  uv("run", "--locked", "ruff", "format", "--check", "src", "tests");
  uv("run", "--locked", "mypy", "--strict", "src");
  uv(
    "run",
    "--locked",
    "pytest",
    "-q",
    "--cov=src",
    "--cov-report=term-missing",
    "--cov-fail-under=80",
    "tests",
  );
  uv("run", "--locked", "pytest", "-q", "tests/integration");
  uv("build", "--no-build-isolation");
  uv(
    "run",
    "--locked",
    "pip-licenses",
    "--format=json",
    "--output-file",
    "rill-python-licenses.json",
  );
  const inventory = JSON.parse(
    readFileSync(join(pythonRoot, "rill-python-licenses.json"), "utf8"),
  );
  assert.ok(inventory.length >= 5, "License inventory cannot be empty");
  uv(
    "run",
    "--locked",
    "pip-licenses",
    "--partial-match",
    "--fail-on",
    "GPL;AGPL;GNU General Public License;GNU Affero General Public License",
  );

  runShellGate();
  const extensionless = join(project, "scripts/status");
  const originalExtensionless = readFileSync(extensionless, "utf8");
  writeFileSync(extensionless, "#!/usr/bin/env bash\nif [; then\n");
  const invalidShell = runShellGate({ mustFail: true });
  assert.match(invalidShell, /error|syntax|SC1/i);
  writeFileSync(extensionless, originalExtensionless);
  runShellGate();

  // The interpreter token, not a later shebang argument, determines
  // whether an extensionless file is Bash/sh. Tabs are legal separators.
  const tabbed = join(project, "scripts/tabbed");
  const notShell = join(project, "scripts/non-shell");
  writeFileSync(tabbed, "#!/bin/bash\t-e\nprintf 'tabbed ready\\n'\n");
  writeFileSync(notShell, "#!/usr/bin/python3 /bin/sh\nprint('not shell')\n");
  runShellGate();
  writeFileSync(tabbed, "#!/bin/bash\t-e\nif [; then\n");
  const rejectedTabbed = runShellGate({ mustFail: true });
  assert.match(rejectedTabbed, /error|syntax|SC1/i);
  writeFileSync(tabbed, "#!/bin/bash\t-e\nprintf 'tabbed ready\\n'\n");
  runShellGate();
  const spaced = join(project, "scripts/spaced-shebang");
  writeFileSync(spaced, "#! /bin/bash\necho valid\n");
  runShellGate();
  writeFileSync(spaced, "#! /bin/bash\nif [; then\n");
  assert.match(runShellGate({ mustFail: true }), /error|syntax|SC1/i);
  rmSync(spaced);
  rmSync(script);
  runShellGate();
  writeFileSync(script, originalShell);

  pinned(["aqua:koalaman/shellcheck"], "shellcheck", [
    "--severity=style",
    script,
  ]);
  pinned(["aqua:mvdan/sh"], "shfmt", ["-d", "-i", "2", script]);
  pinned(["aqua:bats-core/bats-core"], "bats", ["--tap", bats]);

  assert.match(originalPython, /return cleaned\.casefold\(\)/);
  writeFileSync(
    sourcePath,
    originalPython.replace("return cleaned.casefold()", "return cleaned"),
  );
  const failure = execute(
    "mise",
    [
      "-C",
      repository,
      "exec",
      "--locked",
      "uv",
      "--",
      "uv",
      "--directory",
      pythonRoot,
      "run",
      "--locked",
      "pytest",
      "-q",
      "tests/test_core.py",
    ],
    { mustFail: true },
  );
  assert.match(failure, /failed|AssertionError|FAIL/i);
  writeFileSync(sourcePath, originalPython);
  uv("run", "--locked", "pytest", "-q", "tests/test_core.py");

  assert.match(originalShell, /healthy %s/);
  writeFileSync(script, originalShell.replace("healthy %s", "broken %s"));
  const brokenShell = pinned(
    ["aqua:bats-core/bats-core"],
    "bats",
    ["--tap", bats],
    { mustFail: true },
  );
  assert.match(brokenShell, /not ok/);
  writeFileSync(script, originalShell);
  pinned(["aqua:bats-core/bats-core"], "bats", ["--tap", bats]);
});

test("generated React browser gates require page activity and scan the configured product URL", async (t) => {
  const project = join(sandbox, "browser-proof");
  const fixture = join(repository, "tests/fixtures/independent-react");
  mkdirSync(project);
  for (const name of [
    "package.json",
    "pnpm-lock.yaml",
    "playwright.config.mjs",
    "e2e",
  ]) {
    cpSync(join(fixture, name), join(project, name), { recursive: true });
  }
  file(
    project,
    "server.mjs",
    `import { createServer } from "node:http";
createServer((request, response) => {
  if (request.url === "/" && process.env.PRODUCT_REDIRECT_TARGET) {
    response.writeHead(302, { Location: process.env.PRODUCT_REDIRECT_TARGET });
    response.end();
    return;
  }
  const status = request.url === "/health"
    ? 200
    : request.url === (process.env.PRODUCT_ROUTE ?? "/")
      ? Number(process.env.PRODUCT_STATUS ?? 200)
      : 404;
  response.writeHead(status, { "Content-Type": "text/html" });
  response.end('<!doctype html><html lang="en"><head><title>Inventory</title></head><body><main><h1>Inventory</h1></main></body></html>');
}).listen(4178, "127.0.0.1");
createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/html" });
  response.end("<html lang='en'><title>Unrelated service</title></html>");
}).listen(4179, "127.0.0.1");`,
  );
  const config = join(project, "playwright.config.mjs");
  const baselineConfig = readFileSync(config, "utf8")
    .replace('command: "pnpm run dev"', 'command: "node server.mjs"')
    .replace(
      'url: "http://127.0.0.1:4178"',
      'url: "http://127.0.0.1:4178/health"',
    );
  writeFileSync(config, baselineConfig);
  git(project, ["init", "-q", "-b", "main"]);
  git(project, ["add", "."]);
  copyStandard(project, {
    project_name: "Browser proof",
    react: true,
    node: false,
    python: false,
    shell: false,
  });
  const workflow = verifyWorkflow(project);
  pinned(["node", "pnpm"], "pnpm", [
    "--dir",
    project,
    "install",
    "--frozen-lockfile",
  ]);

  const proof = "Verify actual product in system Chrome with axe-core";
  const receipt = join(project, "browser-proof-output.txt");
  const run = (label, options = {}) => {
    const lastProductUrl = existsSync(receipt)
      ? readFileSync(receipt, "utf8")
          .match(/product_url=(.+)/g)
          ?.at(-1)
          ?.slice("product_url=".length)
      : undefined;
    return executeGeneratedStep(workflow, label, project, {
      ...options,
      env: {
        PLAYWRIGHT_BROWSERS_PATH: join(project, "empty-browser-cache"),
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
        ...(label === proof
          ? { GITHUB_OUTPUT: receipt }
          : { RILL_PRODUCT_URL: lastProductUrl }),
        ...options.env,
      },
    });
  };

  const spec = join(project, "e2e/inventory.spec.mjs");
  const original = readFileSync(spec, "utf8");
  const navigating = `import { expect, test } from "@playwright/test";
test("@e2e @a11y opens the product", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
});`;
  run(proof);
  for (const [tag, label] of [
    ["@e2e", "Execute native Chrome E2E test cases"],
    ["@a11y", "Execute native Chrome accessibility test cases"],
  ]) {
    await t.test(`${tag} rejects traces without product page activity`, () => {
      writeFileSync(spec, navigating);
      run(label);
      for (const body of [
        "() => expect(true).toBe(true)",
        'async ({ page }) => expect(page.url()).toBe("about:blank")',
      ]) {
        writeFileSync(
          spec,
          `import { expect, test } from "@playwright/test";\ntest("${tag}", ${body});\n`,
        );
        assert.match(
          run(label, { mustFail: true }),
          /No passing Chrome test recorded the product page/,
        );
      }
    });
  }
  writeFileSync(spec, original);

  for (const status of ["404", "500"]) {
    await t.test(
      `axe rejects a clean HTML response with HTTP ${status}`,
      () => {
        const result = run(proof, {
          mustFail: true,
          env: { PRODUCT_STATUS: status },
        });
        assert.match(
          result,
          new RegExp(`Product page returned HTTP ${status}`),
        );
      },
    );
  }
  await t.test("axe exports the final URL after a product redirect", () => {
    const redirected = "/app/inventory/";
    run(proof, {
      mustFail: true,
      env: { PRODUCT_REDIRECT_TARGET: redirected, PRODUCT_ROUTE: redirected },
    });
    run(proof, {
      env: {
        PRODUCT_REDIRECT_TARGET: redirected,
        PRODUCT_ROUTE: redirected,
        RILL_ALLOWED_PRODUCT_URL: "http://127.0.0.1:4178" + redirected,
      },
    });
    assert.match(
      readFileSync(receipt, "utf8"),
      /product_url=http:\/\/127\.0\.0\.1:4178\/app\/inventory\//,
    );
    writeFileSync(
      spec,
      `import { test } from "@playwright/test";\ntest("@e2e canonical product", async ({ page }) => { await page.goto("${redirected}"); });\n`,
    );
    run("Execute native Chrome E2E test cases", {
      env: { PRODUCT_ROUTE: redirected },
    });
    writeFileSync(spec, original);
    run(proof);
  });
  await t.test(
    "axe preserves the Chrome project and scans its configured route with custom TypeScript discovery",
    () => {
      const browserDir = join(project, "tests/browser");
      mkdirSync(browserDir, { recursive: true });
      renameSync(spec, join(browserDir, "inventory.check.ts"));
      rmSync(join(project, "e2e"), { recursive: true });
      writeFileSync(
        config,
        baselineConfig
          .replace(
            'testDir: "./e2e",',
            'testDir: "./tests/browser",\n  testMatch: "**/*.check.ts",',
          )
          .replace(
            'baseURL: "http://127.0.0.1:4178",',
            'baseURL: "http://127.0.0.1:4178/inventory/",',
          ),
      );
      git(project, ["add", "."]);
      run(proof, { env: { PRODUCT_ROUTE: "/inventory/" } });
      writeFileSync(
        join(browserDir, "inventory.check.ts"),
        `import { test } from "@playwright/test";\ntest("@e2e wrong route", async ({ page }) => { await page.goto("http://127.0.0.1:4178/health"); });\n`,
      );
      assert.match(
        run("Execute native Chrome E2E test cases", {
          mustFail: true,
          env: { PRODUCT_ROUTE: "/inventory/" },
        }),
        /No passing Chrome test recorded the product page/,
      );
      writeFileSync(join(browserDir, "inventory.check.ts"), original);
      const manifestPath = join(project, "package.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      delete manifest.type;
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      renameSync(config, join(project, "playwright.config.ts"));
      git(project, ["add", "."]);
      run(proof, { env: { PRODUCT_ROUTE: "/inventory/" } });
    },
  );
});

test("independent React/Tailwind project executes actual Chrome/UI and CI source gates", () => {
  const project = join(sandbox, "new-react");
  const fixture = join(repository, "tests/fixtures/independent-react");
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) =>
      !path
        .split("/")
        .some((segment) =>
          [
            ".venv",
            "node_modules",
            "dist",
            "coverage",
            "test-results",
            "playwright-report",
          ].includes(segment),
        ),
  });
  const foreignBrowser = join(project, "e2e/separate.spec.ts");
  mkdirSync(dirname(foreignBrowser), { recursive: true });
  writeFileSync(
    foreignBrowser,
    'import { test } from "@playwright/test";\n\ntest("independent browser spec", async ({ page }) => {\n  await page.goto("/");\n});\n',
  );
  const component = join(project, "src/Counter.tsx");
  const original = readFileSync(component, "utf8");
  const originalManifest = readFileSync(join(project, "package.json"), "utf8");

  git(project, ["init", "-q", "-b", "main"]);
  git(project, ["add", "."]);
  git(project, ["commit", "-qm", "Existing independent React UI"]);
  copyStandard(project, {
    project_name: "Independent Inventory",
    react: true,
    node: false,
    python: false,
    shell: false,
    react_root: ".",
    react_coverage: 75,
  });
  const workflow = verifyWorkflow(project);
  executeGeneratedStep(
    workflow,
    "Verify install did not mutate tracked product source",
    project,
  );
  const readme = join(project, "README.md");
  const readmeOriginal = readFileSync(readme, "utf8");
  writeFileSync(readme, readmeOriginal + "\nStaged malicious installer edit\n");
  git(project, ["add", "README.md"]);
  executeGeneratedStep(
    workflow,
    "Verify install did not mutate tracked product source",
    project,
    { mustFail: true },
  );
  executeGeneratedStep(
    workflow,
    "Verify supply-chain installs preserved tracked source",
    project,
    { mustFail: true },
  );
  writeFileSync(readme, readmeOriginal);
  executeGeneratedStep(
    workflow,
    "Verify install did not mutate tracked product source",
    project,
    { mustFail: true },
  );
  git(project, ["reset", "--", "README.md"]);
  executeGeneratedStep(
    workflow,
    "Verify install did not mutate tracked product source",
    project,
  );

  assert.match(workflow, /^ {2}typescript:/m);
  assert.match(workflow, /^ {2}security:/m);
  assert.doesNotMatch(workflow, /^ {2}python:/m);
  assert.doesNotMatch(workflow, /^ {2}shell:/m);
  assert.match(workflow, /PLAYWRIGHT_BROWSERS_PATH:/);
  assert.match(workflow, /jq -e/);
  assert.match(workflow, /playwright test --project=chrome --grep '@e2e'/);
  assert.match(workflow, /playwright test --project=chrome --grep '@a11y'/);
  assert.match(workflow, /vitest run --coverage/);
  assert.match(workflow, /^ {2}merge_group:/m);
  assert.match(workflow, /rill-sbom\.cdx\.json/);
  assert.match(workflow, /--scanners license --include-dev-deps/);
  assert.match(workflow, /--scanners vuln,secret,misconfig --include-dev-deps/);
  assert.match(workflow, /run: pnpm audit\n/);
  assert.match(workflow, /unset GITLEAKS_CONFIG GITLEAKS_CONFIG_TOML/);
  assert.equal(
    workflow.match(/trivy fs --config="" --ignorefile="" --secret-config=""/g)
      ?.length,
    4,
  );
  const security = workflow.slice(workflow.indexOf("  security:"));
  assert.ok(
    security.indexOf("Scan original source and lockfiles") <
      security.indexOf("Install locked JavaScript dependencies"),
  );
  assert.ok(
    security.indexOf("actions/upload-artifact@") <
      security.indexOf("Block forbidden or restricted license classifications"),
  );
  assert.match(
    workflow,
    /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/,
  );
  assert.equal(
    readFileSync(join(project, "package.json"), "utf8"),
    originalManifest,
  );

  const pnpm = (...args) =>
    pinned(["node", "pnpm"], "pnpm", ["--dir", project, ...args]);
  pnpm("install", "--frozen-lockfile");
  for (const command of [
    "lint",
    "typecheck",
    "test:unit",
    "test:integration",
    "test:coverage",
    "build",
    "test:e2e",
    "test:a11y",
  ]) {
    pnpm("run", command);
  }
  executeGeneratedStep(
    workflow,
    "Verify tracked React application and test source",
    project,
  );
  executeGeneratedStep(
    workflow,
    "Execute native Vitest source coverage",
    project,
  );
  executeGeneratedStep(
    workflow,
    "React security and correctness lint with Oxlint",
    project,
  );
  executeGeneratedStep(
    workflow,
    "React source complexity with Lizard",
    project,
  );
  const badReactSource = join(project, "src/disallowed-debugger.ts");
  writeFileSync(
    badReactSource,
    "export function bad() { debugger; return 1; }\n",
  );
  executeGeneratedStep(
    workflow,
    "React security and correctness lint with Oxlint",
    project,
    { mustFail: true },
  );
  rmSync(badReactSource);
  executeGeneratedStep(
    workflow,
    "Execute actual React unit/component tests",
    project,
  );
  const reactUnitFile = join(project, "src/Counter.test.tsx");
  const reactUnitSource = readFileSync(reactUnitFile, "utf8");
  writeFileSync(
    reactUnitFile,
    reactUnitSource.replaceAll("test(", "test.skip("),
  );
  executeGeneratedStep(
    workflow,
    "Execute actual React unit/component tests",
    project,
    { mustFail: true },
  );
  writeFileSync(reactUnitFile, reactUnitSource);
  executeGeneratedStep(
    workflow,
    "Execute actual React integration tests",
    project,
  );
  const reactViteConfig = join(project, "vite.config.ts");
  const oldReactViteConfig = readFileSync(reactViteConfig, "utf8");
  assert.match(oldReactViteConfig, /include: \["src\/\*\*\/\*\.test\.tsx"\]/);
  writeFileSync(
    reactViteConfig,
    oldReactViteConfig.replace(
      'include: ["src/**/*.test.tsx"]',
      'include: ["src/Counter.test.tsx"]',
    ),
  );
  executeGeneratedStep(
    workflow,
    "Execute actual React integration tests",
    project,
    { mustFail: true },
  );
  writeFileSync(reactViteConfig, oldReactViteConfig);

  const untestedModule = join(project, "src/unloaded.mjs");
  writeFileSync(untestedModule, "export function untested() { return 42; }\n");
  git(project, ["add", "src/unloaded.mjs"]);
  executeGeneratedStep(
    workflow,
    "Execute native Vitest source coverage",
    project,
    { mustFail: true },
  );
  rmSync(untestedModule);
  git(project, ["reset", "--", "src/unloaded.mjs"]);
  const quotedModule = join(project, "src/非ASCII模块.ts");
  writeFileSync(
    quotedModule,
    "export function missingCoverage() { return 7; }\n",
  );
  git(project, ["add", "src/非ASCII模块.ts"]);
  executeGeneratedStep(
    workflow,
    "Execute native Vitest source coverage",
    project,
    { mustFail: true },
  );
  rmSync(quotedModule);
  git(project, ["reset", "--", "src/非ASCII模块.ts"]);
  const browserReceipt = join(project, "browser-proof-output.txt");
  executeGeneratedStep(
    workflow,
    "Verify actual product in system Chrome with axe-core",
    project,
    { env: { GITHUB_OUTPUT: browserReceipt } },
  );
  const productUrl = readFileSync(browserReceipt, "utf8").match(
    /product_url=(.+)/,
  )?.[1];
  assert.ok(
    productUrl,
    "A successful Chrome/axe proof must export the native product URL",
  );
  const browserIsolated = {
    env: {
      RILL_PRODUCT_URL: productUrl,
      PLAYWRIGHT_BROWSERS_PATH: join(project, "empty-browser-cache"),
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
    },
  };
  executeGeneratedStep(
    workflow,
    "Execute native Chrome E2E test cases",
    project,
    browserIsolated,
  );
  executeGeneratedStep(
    workflow,
    "Execute native Chrome accessibility test cases",
    project,
    browserIsolated,
  );
  const chromeConfig = join(project, "playwright.config.mjs");
  const baselineChromeConfig = readFileSync(chromeConfig, "utf8");
  assert.match(baselineChromeConfig, /channel: "chrome"/);
  writeFileSync(
    chromeConfig,
    baselineChromeConfig.replace('channel: "chrome"', 'channel: "chromium"'),
  );
  executeGeneratedStep(
    workflow,
    "Execute native Chrome E2E test cases",
    project,
    { ...browserIsolated, mustFail: true },
  );
  writeFileSync(chromeConfig, baselineChromeConfig);

  const e2eFile = join(project, "e2e/inventory.spec.mjs");
  const baselineE2eFile = readFileSync(e2eFile, "utf8");
  writeFileSync(e2eFile, baselineE2eFile.replace("@e2e", "@nonexistent-e2e"));
  executeGeneratedStep(
    workflow,
    "Execute native Chrome E2E test cases",
    project,
    { ...browserIsolated, mustFail: true },
  );
  writeFileSync(e2eFile, baselineE2eFile);
  writeFileSync(
    e2eFile,
    'import { test, expect } from "@playwright/test";\n' +
      'test("@e2e empty confirmation", () => expect(true).toBe(true));\n' +
      'test("@a11y empty confirmation", () => expect(true).toBe(true));\n',
  );
  executeGeneratedStep(
    workflow,
    "Verify actual product in system Chrome with axe-core",
    project,
    { mustFail: true },
  );
  writeFileSync(e2eFile, baselineE2eFile);
  executeGeneratedStep(workflow, "React production build", project);
  const silentBuild = JSON.parse(originalManifest);
  silentBuild.scripts.build = "node -e 'process.exit(0)'";
  writeFileSync(
    join(project, "package.json"),
    JSON.stringify(silentBuild, null, 2) + "\n",
  );
  executeGeneratedStep(workflow, "React production build", project, {
    mustFail: true,
  });
  writeFileSync(join(project, "package.json"), originalManifest);
  const trivy = (...args) => pinned(["aqua:aquasecurity/trivy"], "trivy", args);
  const classifications = join(project, "rill-license-classifications.json");
  const sbom = join(project, "rill-sbom.cdx.json");
  trivy(
    "fs",
    "--scanners",
    "license",
    "--include-dev-deps",
    "--severity",
    "HIGH,CRITICAL",
    "--exit-code",
    "1",
    project,
  );
  trivy(
    "fs",
    "--scanners",
    "license",
    "--include-dev-deps",
    "--format",
    "json",
    "--output",
    classifications,
    project,
  );
  const licenseResults = JSON.parse(readFileSync(classifications, "utf8"));
  assert.ok(
    licenseResults.Results?.some((result) => result.Licenses?.length > 0),
    "The license scanner must inspect installed packages",
  );
  trivy(
    "fs",
    "--include-dev-deps",
    "--format",
    "cyclonedx",
    "--output",
    sbom,
    "--skip-dirs",
    "node_modules",
    project,
  );
  const bill = JSON.parse(readFileSync(sbom, "utf8"));
  assert.equal(bill.bomFormat, "CycloneDX");
  assert.ok(
    bill.components?.length > 0,
    "The SBOM must list real dependencies",
  );

  assert.ok(original.includes("setItems((value) => value + 1)"));
  writeFileSync(
    component,
    original.replace(
      "setItems((value) => value + 1)",
      "setItems((value) => value - 1)",
    ),
  );
  const failure = pinned(
    ["node", "pnpm"],
    "pnpm",
    ["--dir", project, "run", "test:unit"],
    { mustFail: true },
  );
  assert.match(failure, /failed|expected/i);
  const pkgPath = join(project, "package.json");
  const originalPkg = readFileSync(pkgPath, "utf8");
  const altered = JSON.parse(originalPkg);
  altered.scripts["test:unit"] = "node -e 'process.exit(0)'";
  altered.scripts["test:coverage"] = "node -e 'process.exit(0)'";
  writeFileSync(pkgPath, JSON.stringify(altered, null, 2) + "\n");
  pnpm("run", "test:unit");
  executeGeneratedStep(
    workflow,
    "Execute native Vitest source coverage",
    project,
    { mustFail: true },
  );
  writeFileSync(pkgPath, originalPkg);
  writeFileSync(component, original);
  pnpm("run", "test:unit");
});
