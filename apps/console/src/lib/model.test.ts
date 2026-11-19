import { describe, expect, it } from "vitest";
import {
  acceptanceItems,
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
