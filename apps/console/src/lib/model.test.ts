import { describe, expect, it } from "vitest";
import {
  acceptanceItems,
  currentCheck,
  issueClassification,
  issueSections,
  validateDashboard,
} from "./model";

const issue = (blocks: string[]) => ({
  number: 25,
  title: "Delivery",
  state: "OPEN" as const,
  url: "https://github.com/org/repo/issues/25",
  updatedAt: new Date().toISOString(),
  body: "",
  labels: { nodes: [] },
  assignees: { nodes: [] },
  blockedBy: {
    pageInfo: { hasNextPage: false },
    nodes: blocks.map((state, index) => ({
      number: index + 1,
      title: "Blocker",
      url: "https://github.com/org/repo/issues/1",
      state: state as "OPEN" | "CLOSED",
    })),
  },
  blocking: { nodes: [] },
  closedByPullRequestsReferences: { nodes: [] },
});

describe("native issue evidence model", () => {
  it("parses real checked and missing acceptance criteria", () => {
    expect(
      acceptanceItems(
        "## Acceptance\n- [x] Real browser\n- [ ] User approval\n- ordinary bullet",
      ),
    ).toEqual([
      { text: "Real browser", checked: true },
      { text: "User approval", checked: false },
    ]);
  });

  it("keeps later engineering receipts out of formal acceptance", () => {
    expect(
      acceptanceItems(
        "## Acceptance\n- [ ] Real hosted pilot with a new\n  owner-controlled product\n- [ ] Existing project\n\n## Candidate evidence\n- [x] Local fixture\n- [x] Synthetic update",
      ),
    ).toEqual([
      {
        text: "Real hosted pilot with a new owner-controlled product",
        checked: false,
      },
      { text: "Existing project", checked: false },
    ]);
    expect(acceptanceItems("## Evidence\n- [x] Test passed")).toEqual([]);
    expect(
      acceptanceItems(
        "## Acceptance\n### Positive\n- [x] Real successful path\n### Negative\n- [ ] Error recovery\n## Later evidence\n- [x] Synthetic pass",
      ),
    ).toEqual([
      { text: "Real successful path", checked: true },
      { text: "Error recovery", checked: false },
    ]);
  });

  it("does not treat acceptance evidence as formal criteria", () => {
    expect(
      acceptanceItems(
        "## Acceptance evidence\n- [x] Fixture complete\n## Acceptance\n- [ ] Real owner pilot",
      ),
    ).toEqual([{ text: "Real owner pilot", checked: false }]);
  });

  it("ignores fenced headings and checklist examples", () => {
    expect(
      acceptanceItems(
        [
          "```markdown",
          "## Acceptance",
          "- [x] Example before acceptance",
          "```",
          "## Acceptance",
          "- [ ] Real requirement",
          "  ~~~~md",
          "## Example heading",
          "- [x] Example inside acceptance",
          "~~~",
          "- [x] Still inside the example",
          "  ~~~~~",
          "- [x] Another requirement",
        ].join("\n"),
      ),
    ).toEqual([
      { text: "Real requirement", checked: false },
      { text: "Another requirement", checked: true },
    ]);
  });

  it("preserves meaningful document sections for drilldown", () => {
    expect(issueSections("Intro\n\n## Acceptance\n- [ ] test")).toEqual([
      { title: "概览", content: "Intro" },
      { title: "Acceptance", content: "- [ ] test" },
    ]);
  });

  it("reports blocked only with actual open native dependencies", () => {
    expect(issueClassification(issue(["OPEN", "CLOSED"]))).toBe("blocked");
    expect(issueClassification(issue(["CLOSED"]))).toBe("open");
  });

  it("rejects unrelated successful CI and an older SHA when the Quality gate failed", () => {
    const sha = "a".repeat(40);
    const base = {
      branch: "candidate",
      sha,
      dirty: false,
      changedPaths: 0,
      prs: [],
      runs: [
        {
          databaseId: 1,
          name: "Documentation",
          headSha: sha,
          status: "completed",
          conclusion: "success",
          createdAt: "2026-11-19T21:00:00Z",
          url: "https://github.com/example/repo/actions/runs/1",
        },
        {
          databaseId: 2,
          name: "Quality",
          headSha: sha,
          status: "completed",
          conclusion: "failure",
          createdAt: "2026-11-19T20:00:00Z",
          url: "https://github.com/example/repo/actions/runs/2",
        },
        {
          databaseId: 3,
          name: "Quality",
          headSha: "b".repeat(40),
          status: "completed",
          conclusion: "success",
          createdAt: "2026-11-19T22:00:00Z",
          url: "https://github.com/example/repo/actions/runs/3",
        },
      ],
    };
    expect(currentCheck(base)?.databaseId).toBe(2);
    expect(currentCheck({ ...base, runs: [base.runs[0]] })).toBeNull();
  });

  it("rejects incomplete issue graphs instead of calling them valid", () => {
    expect(
      validateDashboard({
        fetchedAt: new Date().toISOString(),
        documents: [],
        errors: [],
        issueData: {
          nameWithOwner: "owner/repo",
          parent: { subIssues: { pageInfo: { hasNextPage: true }, nodes: [] } },
          bugs: { subIssues: { pageInfo: { hasNextPage: false }, nodes: [] } },
        },
      }),
    ).toBe(false);
  });
});
