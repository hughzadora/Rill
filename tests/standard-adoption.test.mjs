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
  const args = [
    "copy",
    "--defaults",
    "--vcs-ref",
    "v0.1.0",
    ...Object.entries(answers).flatMap(([key, value]) => [
      "--data",
      key + "=" + value,
    ]),
    template,
    destination,
  ];
  return pinned(["pypi:copier"], "copier", args);
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
  const body = section.split("\n      - name:")[0];
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

test("brownfield source, tests and unrelated workflows survive adoption and native rollback", () => {
  const project = join(sandbox, "brownfield");
  mkdirSync(project);
  const original = newProduct(project);
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
  executeGeneratedStep(
    workflow,
    "Node source complexity with Lizard",
    project,
    { mustFail: true },
  );
  rmSync(badNodeSource);
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

  git(project, ["add", ".rill", ".github/workflows/rill-quality.yml"]);
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

  git(project, ["add", ".rill", ".github/workflows/rill-quality.yml"]);
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
  git(project, ["add", ".rill", ".github/workflows/rill-quality.yml"]);
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
  assert.match(workflow, /pytest -q --cov="src"/);
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
  git(project, ["reset", "--", "README.md"]);

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
  executeGeneratedStep(workflow, "Verify system Google Chrome", project);
  const browserIsolated = {
    env: {
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
