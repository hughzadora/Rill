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
      name: "transport-schemas-stay-independent",
      severity: "error",
      from: { path: "^src/schemas/" },
      to: { pathNot: "^(src/schemas/|node_modules/zod/)" },
    },
    {
      name: "adapters-do-not-import-the-server",
      severity: "error",
      from: { path: "^src/adapters/" },
      to: { path: "^src/server\\.ts$" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    builtInModules: { add: ["bun", "bun:test"] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["bun", "import", "default"],
    },
  },
};
