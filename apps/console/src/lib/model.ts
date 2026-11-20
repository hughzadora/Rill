export type IssueState = "OPEN" | "CLOSED";

export interface IssueRef {
  number: number;
  title: string;
  state: IssueState;
  url: string;
}

export interface Issue extends IssueRef {
  projectFields?: { status: string | null; priority: string | null } | null;
  body: string;
  updatedAt: string;
  labels: { nodes: { name: string }[] };
  assignees: { nodes: { login: string }[] };
  blockedBy: {
    nodes: IssueRef[];
    pageInfo: { hasNextPage: boolean };
  };
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

function markdownFenceTransition(
  line: string,
  fence: string | undefined,
): { fence: string | undefined; skip: boolean } {
  const delimiter = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
  if (fence) {
    const closes =
      delimiter &&
      delimiter[1][0] === fence[0] &&
      delimiter[1].length >= fence.length &&
      !delimiter[2].trim();
    return { fence: closes ? undefined : fence, skip: true };
  }
  if (delimiter && (delimiter[1][0] === "~" || !delimiter[2].includes("`"))) {
    return { fence: delimiter[1], skip: true };
  }
  return { fence: undefined, skip: false };
}

export function acceptanceItems(body: string): AcceptanceItem[] {
  const items: AcceptanceItem[] = [];
  let sectionDepth: number | null = null;
  let fence: string | undefined;
  for (const line of body.split(/\r?\n/)) {
    const state = markdownFenceTransition(line, fence);
    fence = state.fence;
    if (state.skip) continue;
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const depth = heading[1].length;
      if (sectionDepth !== null && depth <= sectionDepth) break;
      if (
        sectionDepth === null &&
        /^(acceptance(?: criteria)?|验收(?:标准|条件)?)(?:[:：])?$/i.test(
          heading[2].replace(/\s+#+\s*$/, "").trim(),
        )
      ) {
        sectionDepth = depth;
      }
      continue;
    }
    if (sectionDepth === null) continue;
    const check = line.match(/^\s*[-*]\s+\[([xX ])\]\s+(.+?)\s*$/);
    if (check) {
      items.push({ checked: check[1].toLowerCase() === "x", text: check[2] });
    } else if (items.length && /^\s{2,}\S/.test(line)) {
      items[items.length - 1].text += " " + line.trim();
    }
  }
  return items;
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
          issue.blockedBy.pageInfo?.hasNextPage === false &&
          Array.isArray(issue.assignees?.nodes) &&
          Array.isArray(issue.labels?.nodes),
      )
    )
      return false;
  }
  return true;
}
