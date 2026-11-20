import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { Dashboard, Issue, IssueParent } from "./lib/model";

const currentIssue: Issue = {
  number: 25,
  title: "Industrial console delivery",
  state: "OPEN",
  url: "https://github.com/hughzadora/Rill/issues/25",
  body: "## Acceptance\n- [ ] Owner acceptance",
  updatedAt: "2026-11-19T08:00:00Z",
  labels: { nodes: [] },
  assignees: { nodes: [] },
  blockedBy: { pageInfo: { hasNextPage: false }, nodes: [] },
  blocking: { nodes: [] },
  closedByPullRequestsReferences: { nodes: [] },
};
const parent: IssueParent = {
  number: 22,
  title: "Rill industrial factory",
  state: "OPEN",
  body: "Reusable software standard",
  url: "https://github.com/hughzadora/Rill/issues/22",
  updatedAt: "2026-11-19T08:00:00Z",
  subIssues: { pageInfo: { hasNextPage: false }, nodes: [currentIssue] },
};
const dashboard: Dashboard = {
  source: "github-graphql-and-local-git",
  fetchedAt: "2026-11-19T08:00:00Z",
  issueData: {
    nameWithOwner: "hughzadora/Rill",
    url: "https://github.com/hughzadora/Rill",
    parent,
    bugs: {
      number: 23,
      title: "Reproducible bugs",
      state: "OPEN",
      url: "https://github.com/hughzadora/Rill/issues/23",
      subIssues: { pageInfo: { hasNextPage: false }, nodes: [] },
    },
  },
  workspace: {
    branch: "codex/native-feasibility",
    sha: "a".repeat(40),
    dirty: false,
    changedPaths: 0,
    runs: [],
    prs: [],
  },
  quality: {
    standard: "Rill",
    status: "candidate",
    layers: [{ id: "lint", label: "代码规范" }],
    stacks: [
      {
        id: "node",
        label: "Node.js + TypeScript",
        profile: "backend",
        tools: ["Biome"],
        layers: ["lint"],
      },
    ],
  },
  documents: [{ path: "PRD.md", title: "Product" }],
  errors: [],
};

describe("real delivery app request and navigation boundaries", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes live parent/child tasks, pipeline, quality and project documents", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const request = String(input);
      return request.includes("/api/document")
        ? { ok: true, text: async () => "# Factory contract\n\nAll products" }
        : { ok: true, json: async () => dashboard };
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    expect(
      await screen.findByRole("heading", {
        name: "把开发流程变成可验证的生产线",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /任务执行台/ }));
    expect(
      screen.getByRole("heading", { name: "工程任务与交接" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Industrial console delivery", {
        selector: ".task-name",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /软件流水线/ }));
    expect(
      screen.getByRole("heading", { name: "标准化软件交付流水线" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /质量实验室/ }));
    expect(
      screen.getByRole("heading", { name: "质量门禁与测试覆盖" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /工程文档/ }));
    expect(
      await screen.findByRole("heading", { name: "Factory contract" }),
    ).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalled();
  });

  it("holds incomplete data as unknown with named errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ...dashboard,
          issueData: null,
          errors: ["GitHub issue tree unavailable"],
        }),
      })),
    );
    render(<App />);
    expect(
      await screen.findByText(/GitHub issue tree unavailable/),
    ).toBeInTheDocument();
    expect(screen.getByText("项目任务暂不可用")).toBeInTheDocument();
    expect(screen.queryByText("所有项目门禁已通过")).not.toBeInTheDocument();
  });

  it("keeps last observed data after offline refresh and says it may be stale", async () => {
    let count = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        count += 1;
        if (count === 1) return { ok: true, json: async () => dashboard };
        return { ok: false, status: 503 };
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    expect(
      await screen.findByRole("heading", {
        name: "把开发流程变成可验证的生产线",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "刷新真实状态" }));
    expect(await screen.findByText(/本次同步失败/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "把开发流程变成可验证的生产线" }),
    ).toBeInTheDocument();
  });

  it("rejects malformed server evidence rather than accepting a passing state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ...dashboard, fetchedAt: null }),
      })),
    );
    render(<App />);
    expect(await screen.findByText(/格式错误/)).toBeInTheDocument();
    expect(screen.getByText("当前没有可核实的项目事实")).toBeInTheDocument();
  });
});
