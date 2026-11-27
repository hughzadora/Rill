module.exports = {
  forbidden: [
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
    { name: "no-unresolved", severity: "error", from: {}, to: { couldNotResolve: true } },
    {
      name: "no-undeclared-dependencies",
      severity: "error",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
    {
      name: "domain-stays-pure",
      severity: "error",
      from: { path: "^src/domain/" },
      to: { pathNot: "^src/domain/" },
    },
    {
      name: "application-stays-independent",
      severity: "error",
      from: { path: "^src/application/" },
      to: { pathNot: "^src/(application|domain|schemas)/" },
    },
    {
      name: "ui-does-not-import-infrastructure",
      severity: "error",
      from: { path: "^src/ui/" },
      to: { path: "^src/(adapters|application)/" },
    },
    {
      name: "browser-ui-has-no-runtime-builtins",
      severity: "error",
      from: { path: "^src/ui/" },
      to: { dependencyTypes: ["core"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    builtInModules: { add: ["bun", "bun:test", "bun:sqlite"] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
