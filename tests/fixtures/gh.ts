#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const file = process.env.RILL_FIXTURE_STATE;
if (!file) throw new Error("Missing test-owned remote state");
const state = JSON.parse(readFileSync(file, "utf8"));
const args = process.argv.slice(2);
const endpoint = args[3] ?? "";
if (state.offline) {
  console.error("Controlled remote unavailable");
  process.exit(1);
}
if (args.includes("--method")) {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const comment = {
    id: state.nextId++,
    body: JSON.parse(input).body,
    updated_at: new Date().toISOString(),
    user: state.principal ?? { id: 1, login: "example" },
    author_association: "OWNER",
  };
  state.pages.at(-1).push(comment);
  state.posts++;
  if (state.failAfterPost) {
    state.failAfterPost = false;
    writeFileSync(file, JSON.stringify(state));
    console.error("Controlled unknown write result");
    process.exit(1);
  }
  writeFileSync(file, JSON.stringify(state));
  console.log(JSON.stringify(comment));
} else if (endpoint === "user") {
  console.log(JSON.stringify(state.principal ?? { id: 1, login: "example" }));
} else if (endpoint.includes("/issues/comments/")) {
  const comment = state.pages
    .flat()
    .find(
      (entry: { id: number }) =>
        entry.id === Number(endpoint.split("/").at(-1)),
    );
  console.log(
    JSON.stringify(
      state.mismatchReadback
        ? { ...comment, body: "incorrect readback" }
        : comment,
    ),
  );
} else if (endpoint.includes("/comments?")) {
  if (!args.includes("--paginate") || !args.includes("--slurp"))
    throw new Error("Pagination flags missing");
  console.log(JSON.stringify(state.pages));
} else {
  console.log(
    JSON.stringify(
      state.invalidIdentity ? { ...state.issue, number: 999 } : state.issue,
    ),
  );
}
