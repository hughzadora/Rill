const linked = (number, title, state = "OPEN") => ({
  number,
  title,
  state,
  url: "https://github.com/hughzadora/Rill/issues/" + number,
});
const issue = (number, title, body, state = "OPEN", blockers = []) => ({
  ...linked(number, title, state),
  body,
  updatedAt: "2026-11-19T08:40:00Z",
  labels: { nodes: [] },
  assignees: { nodes: number === 25 ? [{ login: "agent-owner" }] : [] },
  blockedBy: { nodes: blockers },
  blocking: { nodes: [] },
  closedByPullRequestsReferences: { nodes: [] },
});
export const dashboard = {
  source: "github-graphql-and-local-git",
  fetchedAt: "2026-11-19T08:40:00Z",
  issueData: {
    nameWithOwner: "hughzadora/Rill",
    url: "https://github.com/hughzadora/Rill",
    parent: {
      ...linked(22, "Rill vNext: industrial software factory"),
      body: "Business requirements and acceptance",
      updatedAt: "2026-11-19T08:40:00Z",
      subIssues: {
        pageInfo: { hasNextPage: false },
        nodes: [
          issue(
            24,
            "Native session continuity",
            "## Acceptance\n- [x] Remove duplicate runtime\n- [ ] Fresh session proof",
          ),
          issue(
            25,
            "Interactive delivery console",
            "## Acceptance\n- [ ] Real task details\n- [ ] Native approval proof",
            "OPEN",
            [linked(31, "Global plugin bug")],
          ),
          issue(
            26,
            "Eight-stage lifecycle",
            "## Acceptance\n- [x] Stage model\n- [ ] Owner check",
          ),
          issue(
            27,
            "Upstream tooling",
            "## Acceptance\n- [ ] Source-specific tooling",
          ),
          issue(28, "Deep clean", "## Acceptance\n- [ ] Source audit"),
          issue(
            29,
            "Independent verification",
            "## Acceptance\n- [ ] Real usage proof",
          ),
        ],
      },
    },
    bugs: {
      ...linked(23, "Permanent defects"),
      subIssues: {
        pageInfo: { hasNextPage: false },
        nodes: [
          linked(30, "Resolved UI defect", "CLOSED"),
          linked(31, "Global plugin bug"),
        ],
      },
    },
  },
  workspace: {
    branch: "codex/native-feasibility",
    sha: "c515adcb48018529e9430412bbc28563c0d8e625",
    dirty: false,
    changedPaths: 0,
    prs: [
      {
        number: 33,
        title: "Software factory source review",
        state: "OPEN",
        isDraft: true,
        url: "https://github.com/hughzadora/Rill/pull/33",
        headRefOid: "c515adcb48018529e9430412bbc28563c0d8e625",
        updatedAt: "2026-11-19T10:31:00Z",
      },
    ],
    runs: [
      {
        databaseId: 1,
        name: "Full quality checks",
        status: "completed",
        conclusion: "success",
        headSha: "not-current-sha",
        url: "https://github.com/hughzadora/Rill/actions/runs/1",
        createdAt: "2026-11-19T08:40:00Z",
      },
    ],
  },
  quality: {
    standard: "Rill",
    status: "candidate",
    layers: [
      ["lint", "代码规范"],
      ["types", "类型与接口"],
      ["unit", "单元与组件"],
      ["integration", "集成与故障"],
      ["system", "端到端与实机"],
      ["accessibility", "无障碍"],
      ["coverage", "覆盖与回归"],
      ["build", "构建与运行"],
      ["security", "安全与供应链"],
    ].map(([id, label]) => ({ id, label })),
    stacks: ["React + Tailwind", "Node.js + TypeScript", "Python", "Shell"].map(
      (label, index) => ({
        id: String(index),
        label,
        profile: "test",
        tools: ["Biome", "Vitest", "Trivy"],
        layers: ["lint", "types", "unit", "integration", "security"],
      }),
    ),
  },
  documents: [
    { title: "Product", path: "PRD.md" },
    { title: "Handoff", path: "HANDOFF.md" },
    { title: "Quality", path: "QUALITY_STANDARD.md" },
  ],
  errors: [],
};
