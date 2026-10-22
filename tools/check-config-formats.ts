import { globSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { parse as parseToml } from "smol-toml";
import { parseDocument } from "yaml";

const root = process.cwd();
const tomlFile = ".codex/config.toml";
const roleTomlGlob = ".codex/agents/*.toml";
const yamlGlob = ".agents/**/*.yaml";
const roleTomlFiles = globSync(roleTomlGlob).sort();
const yamlFiles = globSync(yamlGlob).sort();
const args = process.argv.slice(2);
const explicitFiles = args.length > 0;
const files = explicitFiles
  ? args.map((file) => relative(root, resolve(root, file)).split(sep).join("/"))
  : [tomlFile, ...roleTomlFiles, ...yamlFiles];
const diagnostics: string[] = [];

if (!explicitFiles && !files.includes(tomlFile)) {
  diagnostics.push(`${tomlFile}: required project Codex config file was not found`);
}

for (const file of files) {
  if (
    explicitFiles &&
    file !== tomlFile &&
    !/^\.codex\/agents\/[^/]+\.toml$/.test(file) &&
    !/^\.agents\/.+\.yaml$/.test(file)
  ) {
    diagnostics.push(`${file}: unsupported config syntax path`);
    continue;
  }

  let source: string;
  try {
    source = readFileSync(resolve(root, file), "utf8");
  } catch (error) {
    diagnostics.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    continue;
  }

  if (file === tomlFile || /^\.codex\/agents\/[^/]+\.toml$/.test(file)) {
    try {
      parseToml(source);
    } catch (error) {
      diagnostics.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
    continue;
  }

  try {
    const document = parseDocument(source);
    for (const error of document.errors) {
      const location = error.linePos?.[0];
      diagnostics.push(
        `${file}${location ? `:${location.line}:${location.col}` : ""}: ${error.message.split("\n", 1)[0] ?? error.message}`,
      );
    }
  } catch (error) {
    diagnostics.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (diagnostics.length > 0) {
  for (const diagnostic of diagnostics) {
    console.error(diagnostic);
  }
  process.exitCode = 1;
} else {
  const tomlCount = files.filter(
    (file) => file === tomlFile || /^\.codex\/agents\/[^/]+\.toml$/.test(file),
  ).length;
  const yamlCount = files.length - tomlCount;
  const scope = explicitFiles ? "selected " : "";
  const noun = files.length === 1 ? "file" : "files";
  console.log(
    `config syntax: ${files.length} ${scope}${noun} passed (${tomlCount} TOML, ${yamlCount} YAML)`,
  );
}
