// Bun's CLI shell globbing does not recurse through arbitrary source depth.
// Use its native file scanner to enumerate every TypeScript compiler input.
const entries = [...new Bun.Glob("**/*.ts").scanSync({ cwd: "src", onlyFiles: true })]
  .filter((entry) => !entry.endsWith(".d.ts"))
  .sort()
  .map((entry) => `./src/${entry}`);

if (entries.length === 0) {
  console.error("No TypeScript source files were found under src/.");
  process.exit(1);
}

const result = Bun.spawnSync({
  cmd: [process.execPath, "build", ...entries, "--no-bundle", "--target=node", "--outdir=./dist"],
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(result.exitCode ?? 1);
