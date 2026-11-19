export type IssueState = "OPEN" | "CLOSED";

export interface IssueRef {
  number: number;
  title: string;
  state: IssueState;
  url: string;
}

export interface Issue extends IssueRef {
  body: string;
  updatedAt: string;
  labels: { nodes: { name: string }[] };
  assignees: { nodes: { login: string }[] };
  blockedBy: { nodes: IssueRef[] };
  blocking: { nodes: IssueRef[] };
  closedByPullRequestsReferences: { nodes: IssueRef[] };
}

export interface IssueParent extends IssueRef {
  body: string;
  updatedAt: string;
  subIssues: {
    nodes: Issue[];
    pageInfo: { hasNextPage: boolean };
  };
}

export interface BugParent extends IssueRef {
  subIssues: {
    nodes: (IssueRef & { updatedAt: string })[];
    pageInfo: { hasNextPage: boolean };
  };
}

export interface GitHubIssues {
  nameWithOwner: string;
  url: string;
  parent: IssueParent;
  bugs: BugParent;
}

export interface PullRequest {
  number: number;
  title: string;
  state: string;
  isDraft: boolean;
  url: string;
  headRefOid: string;
  updatedAt: string;
}

export interface CheckRun {
  databaseId: number;
  name: string;
  status: string;
  conclusion: string;
  headSha: string;
  url: string;
  createdAt: string;
}

export interface Workspace {
  branch: string | null;
  sha: string;
  dirty: boolean;
  changedPaths: number;
  prs: PullRequest[] | null;
  runs: CheckRun[] | null;
}

export interface QualityProfile {
  standard: string;
  status: string;
  layers: { id: string; label: string }[];
  stacks: {
    id: string;
    label: string;
    profile: string;
    tools: string[];
    layers: string[];
  }[];
}

export interface Dashboard {
  source: string;
  fetchedAt: string;
  issueData: GitHubIssues | null;
  workspace: Workspace | null;
  quality: QualityProfile | null;
  documents: { title: string; path: string }[];
  errors: string[];
}

export interface AcceptanceItem {
  text: string;
  checked: boolean;
}

export function acceptanceItems(body: string): AcceptanceItem[] {
  const lines = body.split(/\r?\n/);
  const matched = lines.flatMap((line) => {
    const value = line.match(/^\s*[-*]\s+\[([xX ])\]\s+(.+?)\s*$/);
    return value
      ? [{ checked: value[1].toLowerCase() === "x", text: value[2] }]
      : [];
  });
  return matched;
}

export function issueSections(
  body: string,
): { title: string; content: string }[] {
  const sections: { title: string; content: string }[] = [];
  let title = "概览";
  let content: string[] = [];
  const push = () => {
    const value = content.join("\n").trim();
    if (value) sections.push({ title, content: value });
  };
  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      push();
      title = heading[1].trim();
      content = [];
    } else {
      content.push(line);
    }
  }
  push();
  return sections;
}

export function issueSummary(issue: Issue): string {
  const candidate = issueSections(issue.body)
    .flatMap((part) => part.content.split(/\n\s*\n/))
    .map((paragraph) =>
      paragraph
        .replace(/^[-*]\s+/gm, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .find((paragraph) => paragraph.length > 35);
  return (
    candidate?.slice(0, 175) ??
    "该任务未提供可自动摘要的正文，请查看其原生 Issue。"
  );
}

export function outstandingBlocks(issue: Issue): IssueRef[] {
  return issue.blockedBy.nodes.filter((task) => task.state !== "CLOSED");
}

export function issueClassification(
  issue: Issue,
): "blocked" | "closed" | "open" {
  if (issue.state === "CLOSED") return "closed";
  if (outstandingBlocks(issue).length) return "blocked";
  return "open";
}

// .github/workflows/quality.yml owns the required workflow name.
// Other successful jobs cannot be reported as Rill's quality gate.
export function currentCheck(workspace: Workspace | null): CheckRun | null {
  if (!workspace?.runs) return null;
  return (
    workspace.runs
      .filter((run) => run.headSha === workspace.sha && run.name === "Quality")
      .sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      )[0] ?? null
  );
}

export function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function validateDashboard(value: unknown): value is Dashboard {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Dashboard>;
  if (
    typeof candidate.fetchedAt !== "string" ||
    !Array.isArray(candidate.errors) ||
    !Array.isArray(candidate.documents)
  )
    return false;
  if (candidate.issueData) {
    const source = candidate.issueData;
    if (
      typeof source.nameWithOwner !== "string" ||
      !source.parent?.subIssues?.nodes ||
      !Array.isArray(source.parent.subIssues.nodes) ||
      source.parent.subIssues.pageInfo?.hasNextPage ||
      !source.bugs?.subIssues?.nodes ||
      source.bugs.subIssues.pageInfo?.hasNextPage
    )
      return false;
    if (
      !source.parent.subIssues.nodes.every(
        (issue) =>
          Number.isSafeInteger(issue.number) &&
          typeof issue.title === "string" &&
          typeof issue.body === "string" &&
          ["OPEN", "CLOSED"].includes(issue.state) &&
          typeof issue.url === "string" &&
          issue.url.startsWith("https://github.com/") &&
          Array.isArray(issue.blockedBy?.nodes) &&
          Array.isArray(issue.assignees?.nodes) &&
          Array.isArray(issue.labels?.nodes),
      )
    )
      return false;
  }
  return true;
}
