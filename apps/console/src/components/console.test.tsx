import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  Dashboard,
  Issue,
  IssueParent,
  IssueRef,
  QualityProfile,
  Workspace,
} from "../lib/model";
import { DocsPanel } from "./DocsPanel";
import { Overview } from "./Overview";
import { Pipeline } from "./Pipeline";
import { QualityPanel } from "./QualityPanel";
import { TaskBoard } from "./TaskBoard";

const reference = (
  number: number,
  title: string,
  state: "OPEN" | "CLOSED" = "OPEN",
): IssueRef => ({
  number,
  title,
  state,
  url: "https://github.com/hughzadora/Rill/issues/" + number,
});
const makeIssue = (number: number, options: Partial<Issue> = {}): Issue => ({
  ...reference(
    number,
    number === 24 ? "Native continuity" : "Visual delivery console",
  ),
  body: "## Acceptance\n- [x] Existing code cleaned\n- [ ] User verified behavior",
  updatedAt: "2026-11-19T08:40:00Z",
  labels: { nodes: [] },
  assignees: { nodes: [] },
  blockedBy: { pageInfo: { hasNextPage: false }, nodes: [] },
  blocking: { nodes: [] },
  closedByPullRequestsReferences: { nodes: [] },
  ...options,
});
const parent: IssueParent = {
  ...reference(22, "Industrial Rill factory"),
  body: "Reusable software factory",
  updatedAt: "2026-11-19T08:40:00Z",
  subIssues: {
    pageInfo: { hasNextPage: false },
    nodes: [
      makeIssue(24),
      makeIssue(25, {
        blockedBy: {
          pageInfo: { hasNextPage: false },
          nodes: [reference(31, "Retired plugin bug")],
        },
      }),
    ],
  },
};
const workspace: Workspace = {
  branch: "codex/native-feasibility",
  sha: "exact-current",
  dirty: false,
  changedPaths: 0,
  prs: [],
  runs: [
    {
      databaseId: 20,
      name: "Quality",
      status: "completed",
      conclusion: "success",
      headSha: "previous-sha",
      url: "https://github.com/hughzadora/Rill/actions/runs/20",
      createdAt: "2026-11-19T08:40:00Z",
    },
  ],
};
const quality: QualityProfile = {
  standard: "Rill",
  status: "candidate",
  layers: [
    { id: "lint", label: "代码规范" },
    { id: "security", label: "安全与供应链" },
  ],
  stacks: [
    {
      id: "react",
      label: "React + Tailwind",
      profile: "frontend",
      tools: ["Biome", "Playwright"],
      layers: ["lint", "security"],
    },
  ],
};

describe("factory delivery console components", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows full issue acceptance and real blocking dependencies", async () => {
    const user = userEvent.setup();
    render(<TaskBoard parent={parent} repository="hughzadora/Rill" />);
    const board = screen.getByRole("table", { name: "原生 GitHub 工程子任务" });
    expect(within(board).getAllByRole("row")).toHaveLength(3);
    await user.click(
      screen.getByRole("button", { name: /Visual delivery console/ }),
    );
    const inspector = screen.getByRole("complementary", { name: "任务详情" });
    expect(
      within(inspector).getByText("#31 Retired plugin bug"),
    ).toBeInTheDocument();
    expect(within(inspector).getByText("1 / 2 勾选")).toBeInTheDocument();
    expect(
      within(inspector).getAllByText("User verified behavior"),
    ).toHaveLength(2);
    expect(within(inspector).getByText("1 项尚未关闭")).toBeInTheDocument();
  });

  it("selects and links to the correct issue when repository numbers collide", async () => {
    const user = userEvent.setup();
    const crossRepoUrl = "https://github.com/hughzadora/Another/issues/24";
    const crossRepoParent = {
      ...parent,
      subIssues: {
        ...parent.subIssues,
        nodes: [
          makeIssue(24),
          makeIssue(24, { title: "Cross-repository task", url: crossRepoUrl }),
        ],
      },
    };
    render(<TaskBoard parent={crossRepoParent} repository="hughzadora/Rill" />);
    const native = screen.getByRole("button", { name: /Native continuity/ });
    const crossRepo = screen.getByRole("button", {
      name: /Cross-repository task/,
    });
    await user.click(crossRepo);
    expect(crossRepo).toHaveAttribute("aria-current", "true");
    expect(native).not.toHaveAttribute("aria-current");
    const inspector = screen.getByRole("complementary", { name: "任务详情" });
    expect(
      within(inspector).getByRole("heading", { name: "Cross-repository task" }),
    ).toBeInTheDocument();
    for (const link of within(inspector).getAllByRole("link")) {
      expect(link).toHaveAttribute("href", crossRepoUrl);
    }
  });

  it("shows native project status and priority with explicit unknown values", async () => {
    const user = userEvent.setup();
    const assigned = {
      ...makeIssue(24),
      projectFields: { status: "In review", priority: "P1" },
    };
    render(
      <TaskBoard
        parent={{
          ...parent,
          subIssues: { ...parent.subIssues, nodes: [assigned, makeIssue(25)] },
        }}
        repository="hughzadora/Rill"
      />,
    );
    expect(screen.getByText("In review")).toBeInTheDocument();
    expect(screen.getByText("P1")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Visual delivery console/ }),
    );
    expect(
      within(
        screen.getByRole("complementary", { name: "任务详情" }),
      ).getAllByText("未知"),
    ).toHaveLength(2);
  });

  it("filters tasks using live issue properties, not title-only matching", async () => {
    const user = userEvent.setup();
    render(<TaskBoard parent={parent} repository="hughzadora/Rill" />);
    await user.click(screen.getByRole("button", { name: "受阻" }));
    expect(
      screen
        .getByRole("table", { name: "原生 GitHub 工程子任务" })
        .querySelectorAll("tbody tr"),
    ).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "全部" }));
    await user.type(
      screen.getByRole("textbox", { name: "搜索任务" }),
      "User verified behavior",
    );
    expect(
      screen
        .getByRole("table", { name: "原生 GitHub 工程子任务" })
        .querySelectorAll("tbody tr"),
    ).toHaveLength(2);
    await user.clear(screen.getByRole("textbox", { name: "搜索任务" }));
    await user.type(
      screen.getByRole("textbox", { name: "搜索任务" }),
      "no-such-task",
    );
    expect(
      screen.getByText("没有符合筛选条件的任务。试试更宽的关键词或状态。"),
    ).toBeInTheDocument();
  });

  it("never treats an earlier SHA's successful CI as passing now", () => {
    render(<QualityPanel quality={quality} workspace={workspace} />);
    expect(screen.getByText("当前提交暂无托管执行记录")).toBeInTheDocument();
    expect(screen.getAllByText("待验证").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("React + Tailwind", { selector: "strong" }),
    ).toHaveLength(2);
  });

  it("shows real decisions as native-only, with scoped navigation", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<Pipeline onNavigate={navigate} />);
    await user.click(screen.getByRole("button", { name: /完整设计与取舍/ }));
    expect(
      screen.getByText("重大取舍通过 Harness 原生选项"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看完整质量矩阵" }));
    expect(navigate).toHaveBeenCalledWith("quality");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("renders GitHub project facts and distinguishes acceptance from fixture checks", () => {
    const navigate = vi.fn();
    const dashboard: Dashboard = {
      source: "github-graphql-and-local-git",
      fetchedAt: "2026-11-19T08:40:00Z",
      issueData: {
        nameWithOwner: "hughzadora/Rill",
        url: "https://github.com/hughzadora/Rill",
        parent,
        bugs: {
          ...reference(23, "Bug ledger"),
          subIssues: {
            pageInfo: { hasNextPage: false },
            nodes: [
              {
                ...reference(31, "Plugin bug"),
                updatedAt: "2026-11-19T08:40:00Z",
              },
            ],
          },
        },
      },
      workspace,
      quality,
      documents: [],
      errors: [],
    };
    render(<Overview data={dashboard} onNavigate={navigate} />);
    expect(screen.getByText("未达到正式工业交付标准")).toBeInTheDocument();
    expect(screen.getByText("未发现当前提交的 CI")).toBeInTheDocument();
    expect(screen.getByText("Native continuity")).toBeInTheDocument();
  });

  it("follows relative links within the allowlisted engineering documents", async () => {
    const user = userEvent.setup();
    const content: Record<string, string> = {
      "PRD.md": "[Quality](QUALITY_STANDARD.md)",
      "QUALITY_STANDARD.md": "[Adoption](standards/README.md)",
      "standards/README.md":
        "[Product][prd] · [Private](../.git/config) · [API](/api/dashboard) · " +
        "[External](https://github.com) · [Unsafe](javascript:alert%281%29)\n\n" +
        "[prd]: ../PRD.md",
    };
    const fetcher = vi.fn(async (url: string) => ({
      ok: true,
      text: async () => content[decodeURIComponent(url.split("=")[1])],
    }));
    vi.stubGlobal("fetch", fetcher);
    render(
      <DocsPanel
        documents={Object.keys(content).map((path) => ({ title: path, path }))}
      />,
    );
    await user.click(await screen.findByRole("link", { name: "Quality" }));
    await user.click(await screen.findByRole("link", { name: "Adoption" }));
    expect(
      await screen.findByRole("link", { name: "Product" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "External" })).toHaveAttribute(
      "href",
      "https://github.com",
    );
    for (const name of ["Private", "API", "Unsafe"]) {
      expect(
        screen.getByText(
          (_, element) =>
            element?.tagName === "P" &&
            (element.textContent?.includes(name) ?? false),
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
    await user.click(screen.getByRole("link", { name: "Product" }));
    expect(
      await screen.findByRole("link", { name: "Quality" }),
    ).toBeInTheDocument();
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/document?path=PRD.md",
      "/api/document?path=QUALITY_STANDARD.md",
      "/api/document?path=standards%2FREADME.md",
      "/api/document?path=PRD.md",
    ]);
  });

  it("reads allowed engineering documentation and preserves loading failures", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async (input: string) => {
      if (input.includes("HANDOFF.md")) return { ok: false };
      return {
        ok: true,
        text: async () => "# Factory contract\n\n## Release\n\n- [ ] Verified",
      };
    });
    vi.stubGlobal("fetch", fetcher);
    render(
      <DocsPanel
        documents={[
          { title: "Product", path: "PRD.md" },
          { title: "Handoff", path: "HANDOFF.md" },
        ]}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "Factory contract" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Handoff/ }));
    await waitFor(() =>
      expect(
        screen.getByText(
          "当前文档不可读取。无法从缺失信息推断决策或交接状态。",
        ),
      ).toBeInTheDocument(),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
