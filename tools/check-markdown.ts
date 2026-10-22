import { globSync } from "node:fs";
import { lint, readConfig } from "markdownlint/sync";

const files = globSync("**/*.md", {
  exclude: ["**/.git/**", "**/coverage/**", "**/node_modules/**", "docs/tool-for-quality-gate.md"],
}).sort();

if (files.length === 0) {
  throw new Error("No project Markdown documents found");
}

const results = lint({
  files,
  config: readConfig(".markdownlint.json"),
});

const violations = Object.entries(results).flatMap(([file, errors]) =>
  errors.map(
    (error) =>
      `${file}:${error.lineNumber} ${error.ruleNames[0]} ${error.ruleDescription}${error.errorDetail ? `: ${error.errorDetail}` : ""}`,
  ),
);

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(violation);
  }
  process.exitCode = 1;
} else {
  console.log(`markdownlint: ${files.length} project documents passed`);
}
