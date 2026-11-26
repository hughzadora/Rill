import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

const host = "127.0.0.1";
const port = Number(process.env.RILL_WEB_PORT ?? "0");
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("RILL_WEB_PORT must be an integer from 0 to 65535");
}

const build = new URL("../dist/web/", import.meta.url);
const routes = new Map([
  ["/", { body: await readFile(new URL("index.html", build)), type: "text/html" }],
  ["/index.js", { body: await readFile(new URL("index.js", build)), type: "text/javascript" }],
  ["/health", { body: Buffer.from("ready\n"), type: "text/plain" }],
]);
const server = createServer((request, response) => {
  const address = server.address();
  if (
    typeof address !== "object" ||
    !address ||
    request.headers.host !== `${host}:${address.port}`
  ) {
    response.writeHead(400).end("Invalid host\n");
    return;
  }
  if (request.method !== "GET") {
    response.writeHead(405, { Allow: "GET" }).end("Method not allowed\n");
    return;
  }
  const route = routes.get(request.url ?? "");
  if (!route) {
    response.writeHead(404).end("Not found\n");
    return;
  }
  response.writeHead(200, { "Content-Type": `${route.type}; charset=utf-8` }).end(route.body);
});

server.on("error", (error) => {
  if ("code" in error && error.code === "EADDRINUSE") {
    console.error(
      `Preview port ${port} is already in use. Leave RILL_WEB_PORT unset to choose a free port.`,
    );
  }
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  const address = server.address();
  if (typeof address !== "object" || !address) throw new Error("Expected a TCP listener");
  console.log(new URL(`http://${address.address}:${address.port}`).href);
});
process.once("SIGTERM", () => server.close());
process.once("SIGINT", () => server.close());
