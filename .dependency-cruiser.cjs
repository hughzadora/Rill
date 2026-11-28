module.exports = {
  forbidden: [
    {
      name: "no-circular-dependencies",
      comment: "Circular dependencies create architectural rot",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
  },
};
