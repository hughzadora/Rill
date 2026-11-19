import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const content = join(root, "prototype");
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
  throw new Error("Pass parent and bug issue numbers, with a valid PORT");
}

const query = `query($owner:String!,$name:String!,$parent:Int!,$bugs:Int!){
  repository(owner:$owner,name:$name) {
    parent:issue(number:$parent){number title state updatedAt url subIssues(first:100){pageInfo{hasNextPage} nodes{number title state updatedAt url}}}
    bugs:issue(number:$bugs){number title state url subIssues(first:100){pageInfo{hasNextPage} nodes{number title state url}}}
  }
}`;
const reply = (response, status, type, data) => {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(data);
};

createServer(async (request, response) => {
  if (request.headers.host !== `127.0.0.1:${port}`) {
    reply(response, 403, "text/plain; charset=utf-8", "Unexpected host");
    return;
  }
  if (request.method !== "GET") {
    reply(response, 405, "text/plain; charset=utf-8", "Read-only preview");
    return;
  }
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/api/progress") {
    try {
      const { stdout: identity } = await run(
        "gh",
        ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
        { cwd: root, timeout: 15000 },
      );
      const [owner, name] = identity.trim().split("/");
      if (!owner || !name) throw new Error("Cannot resolve GitHub repository");
      const { stdout } = await run(
        "gh",
        [
          "api",
          "graphql",
          "-f",
          `query=${query}`,
          "-f",
          `owner=${owner}`,
          "-f",
          `name=${name}`,
          "-F",
          `parent=${parent}`,
          "-F",
          `bugs=${bugs}`,
        ],
        { cwd: root, timeout: 15000, maxBuffer: 1024 * 1024 },
      );
      const parsed = JSON.parse(stdout);
      if (
        parsed.errors?.length ||
        !parsed.data?.repository?.parent ||
        parsed.data.repository.parent.subIssues.pageInfo.hasNextPage ||
        parsed.data.repository.bugs?.subIssues.pageInfo.hasNextPage
      ) {
        throw new Error("GitHub returned no authoritative issue tree");
      }
      reply(
        response,
        200,
        "application/json; charset=utf-8",
        JSON.stringify({
          source: "github-graphql",
          fetchedAt: new Date().toISOString(),
          ...parsed.data.repository,
        }),
      );
    } catch {
      reply(
        response,
        503,
        "application/json; charset=utf-8",
        JSON.stringify({
          error:
            "GitHub issue state is unavailable; the page will keep its clearly dated snapshot",
        }),
      );
    }
    return;
  }
  const files = new Map([
    ["/", "rill-journey.html"],
    ["/rill-journey.html", "rill-journey.html"],
    ["/evidence/desktop.png", "evidence/desktop.png"],
    ["/evidence/mobile.png", "evidence/mobile.png"],
  ]);
  const filename = files.get(url.pathname);
  if (!filename) {
    reply(response, 404, "text/plain; charset=utf-8", "Not found");
    return;
  }
  try {
    const bytes = await readFile(join(content, filename));
    reply(
      response,
      200,
      filename.endsWith(".png") ? "image/png" : "text/html; charset=utf-8",
      bytes,
    );
  } catch {
    reply(response, 404, "text/plain; charset=utf-8", "Not found");
  }
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `Read-only Rill preview: http://127.0.0.1:${port}/rill-journey.html\n`,
  );
});
