import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const executeFile = promisify(execFile);
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const buildRoot = join(root, "apps/console/dist");
const parent = Number(process.argv[2]);
const bugs = Number(process.argv[3]);
const port = Number(process.env.PORT);
if (
  ![parent, bugs, port].every(Number.isSafeInteger) ||
  parent < 1 ||
  bugs < 1 ||
  port < 1 ||
  port > 65535
) {
  throw new Error(
    "Pass positive parent and bug issue numbers with a valid PORT",
  );
}

const query =
  "query($owner:String!,$name:String!,$parent:Int!,$bugs:Int!){repository(owner:$owner,name:$name){" +
  "nameWithOwner url parent:issue(number:$parent){number title body state updatedAt url subIssues(first:100){" +
  "pageInfo{hasNextPage} nodes{number title body state updatedAt url labels(first:20){nodes{name}}" +
  "assignees(first:20){nodes{login}} blockedBy(first:100){pageInfo{hasNextPage} nodes{number title state url}}" +
  "blocking(first:30){nodes{number title state url}}" +
  "closedByPullRequestsReferences(first:20){nodes{number title state url}}}}}" +
  "bugs:issue(number:$bugs){number title state url subIssues(first:100){" +
  "pageInfo{hasNextPage} nodes{number title state url updatedAt}}}}}";

const execute = async (command, args) => {
  const { stdout } = await executeFile(command, args, {
    cwd: root,
    timeout: 15000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout.trim();
};

const github = async () => {
  const identity = await execute("gh", [
    "repo",
    "view",
    "--json",
    "nameWithOwner",
    "--jq",
    ".nameWithOwner",
  ]);
  const [owner, name] = identity.split("/");
  if (!owner || !name) throw new Error("No authoritative GitHub repository");
  const raw = await execute("gh", [
    "api",
    "graphql",
    "-f",
    "query=" + query,
    "-f",
    "owner=" + owner,
    "-f",
    "name=" + name,
    "-F",
    "parent=" + parent,
    "-F",
    "bugs=" + bugs,
  ]);
  const parsed = JSON.parse(raw);
  const result = parsed.data?.repository;
  if (
    parsed.errors?.length ||
    !result?.parent?.subIssues ||
    !result?.bugs?.subIssues ||
    result.parent.subIssues.pageInfo.hasNextPage ||
    result.bugs.subIssues.pageInfo.hasNextPage ||
    result.parent.subIssues.nodes.some(
      (issue) => issue.blockedBy?.pageInfo?.hasNextPage !== false,
    )
  ) {
    throw new Error("Incomplete authoritative GitHub issue tree");
  }
  return result;
};

const workspace = async () => {
  const [branch, sha, changes] = await Promise.all([
    execute("git", ["branch", "--show-current"]),
    execute("git", ["rev-parse", "HEAD"]),
    execute("git", ["status", "--porcelain", "--untracked-files=all"]),
  ]);
  // GitHub Actions checks out a detached HEAD. Do not query an empty branch
  // as if it identified a particular PR or attribute unrelated CI runs.
  const [prs, runs] = branch
    ? await Promise.allSettled([
        execute("gh", [
          "pr",
          "list",
          "--head",
          branch,
          "--state",
          "all",
          "--limit",
          "10",
          "--json",
          "number,title,state,isDraft,url,headRefOid,updatedAt",
        ]),
        execute("gh", [
          "run",
          "list",
          "--workflow",
          ".github/workflows/quality.yml",
          "--branch",
          branch,
          "--limit",
          "8",
          "--json",
          "databaseId,name,status,conclusion,headSha,url,createdAt",
        ]),
      ])
    : [{ status: "rejected" }, { status: "rejected" }];
  return {
    branch: branch || null,
    sha,
    dirty: Boolean(changes),
    changedPaths: changes.split("\n").filter(Boolean).length,
    prs: prs.status === "fulfilled" ? JSON.parse(prs.value) : null,
    runs: runs.status === "fulfilled" ? JSON.parse(runs.value) : null,
  };
};

const documents = [
  ["Product", "PRD.md"],
  ["Architecture", "ARCHITECTURE.md"],
  ["Design", "DESIGN.md"],
  ["Policy", "POLICY.md"],
  ["Project Management", "PROJECT_MANAGEMENT.md"],
  ["Handoff", "HANDOFF.md"],
  ["Quality", "QUALITY_STANDARD.md"],
  ["Multi-Agent", "MULTI_AGENT.md"],
  ["Roadmap", "ROADMAP.md"],
  ["Glossary", "GLOSSARY.md"],
  ["README", "README.md"],
  ["Standard Adoption", "standards/README.md"],
];

const headers = (type) => ({
  "Content-Type": type,
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
});
const send = (response, status, type, data) => {
  response.writeHead(status, headers(type));
  response.end(data);
};
const json = (response, status, value) =>
  send(
    response,
    status,
    "application/json; charset=utf-8",
    JSON.stringify(value),
  );
const unavailable = (response) =>
  json(response, 503, { error: "Authoritative source unavailable" });

createServer(async (request, response) => {
  if (request.headers.host !== "127.0.0.1:" + port) {
    send(response, 403, "text/plain", "Unexpected host");
    return;
  }
  if (request.method !== "GET") {
    send(response, 405, "text/plain", "Read-only preview");
    return;
  }
  const url = new URL(request.url ?? "/", "http://127.0.0.1:" + port);
  try {
    if (url.pathname === "/api/dashboard") {
      const [issueResult, workspaceResult, quality] = await Promise.allSettled([
        github(),
        workspace(),
        readFile(join(root, "standards/quality-gates.json"), "utf8"),
      ]);
      const issueData =
        issueResult.status === "fulfilled" ? issueResult.value : null;
      const worktree =
        workspaceResult.status === "fulfilled" ? workspaceResult.value : null;
      const errors = [
        ...(issueData ? [] : ["GitHub issue tree unavailable"]),
        ...(worktree ? [] : ["Local Git state unavailable"]),
        ...(worktree?.prs === null ? ["GitHub PR state unavailable"] : []),
        ...(worktree?.runs === null ? ["GitHub CI run state unavailable"] : []),
        ...(quality.status === "fulfilled"
          ? []
          : ["Versioned quality standard unavailable"]),
      ];
      json(response, errors.length ? 206 : 200, {
        source: "github-graphql-and-local-git",
        fetchedAt: new Date().toISOString(),
        issueData,
        workspace: worktree,
        quality:
          quality.status === "fulfilled" ? JSON.parse(quality.value) : null,
        documents: documents.map(([title, path]) => ({ title, path })),
        errors,
      });
      return;
    }
    if (url.pathname === "/api/progress") {
      json(response, 200, {
        source: "github-graphql",
        fetchedAt: new Date().toISOString(),
        ...(await github()),
      });
      return;
    }
    if (url.pathname === "/api/document") {
      const path = url.searchParams.get("path");
      if (!documents.some((item) => item[1] === path)) {
        send(response, 404, "text/plain", "Unknown document");
        return;
      }
      send(
        response,
        200,
        "text/plain; charset=utf-8",
        await readFile(join(root, path), "utf8"),
      );
      return;
    }
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const target = resolve(buildRoot, "." + pathname);
    const within = relative(buildRoot, target);
    if (
      within === ".." ||
      within.startsWith(".." + sep) ||
      isAbsolute(within) ||
      ![".html", ".js", ".css", ".svg", ".png", ".woff2", ".ico"].includes(
        extname(target),
      )
    ) {
      send(response, 404, "text/plain", "Not found");
      return;
    }
    if (!(await stat(target)).isFile()) throw new Error("Not a file");
    const contentTypes = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".woff2": "font/woff2",
      ".ico": "image/x-icon",
    };
    send(
      response,
      200,
      contentTypes[extname(target)] + "; charset=utf-8",
      await readFile(target),
    );
  } catch {
    if (url.pathname.startsWith("/api/")) unavailable(response);
    else
      send(response, 404, "text/plain", "Not found (build the console first)");
  }
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(
    "Rill delivery console http://127.0.0.1:" + port + "/\n",
  );
});
