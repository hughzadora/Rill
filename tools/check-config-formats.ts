import { existsSync, globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseToml } from "smol-toml";
import { parseDocument } from "yaml";

const root = process.cwd();
const tomlFile = ".codex/config.toml";
const yamlFiles = globSync(".agents/**/*.yaml").sort();
const files = [tomlFile, ...yamlFiles];
const diagnostics: string[] = [];

if (!existsSync(resolve(root, tomlFile))) {
  diagnostics.push(`${tomlFile}: required project Codex config file was not found`);
}

if (yamlFiles.length === 0) {
  diagnostics.push(".agents/**/*.yaml: no agent configuration files were found");
}

for (const file of files) {
  if (!existsSync(resolve(root, file))) {
    continue;
  }

  const source = readFileSync(resolve(root, file), "utf8");

  if (file === tomlFile) {
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
  console.log(`config syntax: ${files.length} files passed (1 TOML, ${yamlFiles.length} YAML)`);
}
