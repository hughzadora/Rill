/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-cross-package-relative-imports",
      severity: "error",
      from: { path: "^packages/([^/]+)/" },
      to: { path: "^packages/", pathNot: "^packages/$1/", dependencyTypes: ["local"] },
    },
    {
      name: "no-undeclared-dependencies",
      severity: "error",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
    {
      name: "no-unresolved-imports",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    webpackConfig: { fileName: "dependency-cruiser.resolve.cjs" },
    exclude: { path: "(?:^|/)(?:dist|temp)/" },
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
  },
};
