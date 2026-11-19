import { lstatSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

export class ProjectPathBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectPathBoundaryError";
  }
}

/** Returns a project-relative path after rejecting symlinked path components. */
export function checkedProjectPath(root: string, projectRelativePath: string) {
  const absoluteRoot = resolve(root);
  let canonicalRoot: string;
  try {
    canonicalRoot = realpathSync(absoluteRoot);
  } catch {
    throw new ProjectPathBoundaryError(
      "Project root is missing or inaccessible",
    );
  }
  if (canonicalRoot !== absoluteRoot)
    throw new ProjectPathBoundaryError(
      "Project root is not its canonical path",
    );
  const rootStat = lstatSync(absoluteRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink())
    throw new ProjectPathBoundaryError(
      "Project root is not a regular directory",
    );

  const target = resolve(absoluteRoot, projectRelativePath);
  const insidePath = relative(absoluteRoot, target);
  if (
    !insidePath ||
    insidePath === ".." ||
    insidePath.startsWith(`..${sep}`) ||
    isAbsolute(insidePath)
  )
    throw new ProjectPathBoundaryError(
      "Project path escapes the canonical root",
    );

  const components = insidePath.split(sep);
  let current = absoluteRoot;
  for (const [index, component] of components.entries()) {
    current = resolve(current, component);
    let stat: ReturnType<typeof lstatSync>;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      )
        return target;
      throw error;
    }
    if (stat.isSymbolicLink())
      throw new ProjectPathBoundaryError(
        `Project path crosses a symlink: ${current}`,
      );
    if (index < components.length - 1 && !stat.isDirectory())
      throw new ProjectPathBoundaryError(
        `Project path parent is not a directory: ${current}`,
      );
  }
  return target;
}
