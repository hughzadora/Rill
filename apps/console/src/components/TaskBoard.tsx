import { useMemo, useState } from "react";
import {
  acceptanceItems,
  formatTime,
  type Issue,
  type IssueParent,
  issueClassification,
  issueSections,
  issueSummary,
  outstandingBlocks,
} from "../lib/model";
import { MarkdownContent } from "./MarkdownContent";

type TaskFilter = "all" | "open" | "blocked" | "closed" | "unassigned";

const filters: { key: TaskFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "open", label: "开放" },
  { key: "blocked", label: "受阻" },
  { key: "unassigned", label: "未分配" },
  { key: "closed", label: "已关闭" },
];

function StateText({ issue }: { issue: Issue }) {
  const key = issueClassification(issue);
  const label =
    key === "blocked" ? "受阻" : key === "closed" ? "已关闭" : "待推进";
  return <span className={"status-text status-" + key}>{label}</span>;
}

function TaskInspector({ issue }: { issue: Issue }) {
  const acceptance = acceptanceItems(issue.body);
  const sections = issueSections(issue.body);
  const blockers = outstandingBlocks(issue);
  const assignees = issue.assignees.nodes.map((person) => person.login);
  const linkedPrs = issue.closedByPullRequestsReferences.nodes;
  const completed = acceptance.filter((item) => item.checked).length;

  return (
    <aside className="task-inspector" aria-label="任务详情">
      <div className="inspector-head">
        <div>
          <span className="eyebrow">当前选中 / #{issue.number}</span>
          <h3>{issue.title}</h3>
        </div>
        <a
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="link-action"
        >
          原生 Issue ↗
        </a>
      </div>
      <p className="task-summary">{issueSummary(issue)}</p>
      <dl className="attribute-grid">
        <div>
          <dt>GitHub 状态</dt>
          <dd>
            <StateText issue={issue} />
          </dd>
        </div>
        <div>
          <dt>GitHub Projects 阶段</dt>
          <dd>{issue.projectFields?.status ?? "未知"}</dd>
        </div>
        <div>
          <dt>GitHub Projects 优先级</dt>
          <dd>{issue.projectFields?.priority ?? "未知"}</dd>
        </div>
        <div>
          <dt>负责人</dt>
          <dd>{assignees.length ? assignees.join(", ") : "未分配"}</dd>
        </div>
        <div>
          <dt>最后更新</dt>
          <dd>{formatTime(issue.updatedAt)}</dd>
        </div>
        <div>
          <dt>阻塞依赖</dt>
          <dd>
            {blockers.length
              ? blockers.length + " 项尚未关闭"
              : "未记录开放依赖"}
          </dd>
        </div>
      </dl>
      <section
        className="inspector-section"
        aria-labelledby="acceptance-heading"
      >
        <div className="inspector-section-head">
          <h4 id="acceptance-heading">验收标准</h4>
          <span className="small-muted">
            {acceptance.length
              ? completed + " / " + acceptance.length + " 勾选"
              : "未结构化"}
          </span>
        </div>
        {acceptance.length ? (
          <ul className="acceptance-list">
            {acceptance.map((item) => (
              <li key={item.text} className={item.checked ? "is-checked" : ""}>
                <span aria-hidden="true">{item.checked ? "✓" : "○"}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="unknown-block">
            正文没有可机器识别的验收清单。这不代表任务已完成；可展开下方的原始验收章节。
          </div>
        )}
      </section>
      <section className="inspector-section">
        <div className="inspector-section-head">
          <h4>阻塞与实现关联</h4>
        </div>
        {blockers.length ? (
          <ul className="ref-list">
            {blockers.map((task) => (
              <li key={task.url}>
                <a href={task.url} target="_blank" rel="noopener noreferrer">
                  #{task.number} {task.title}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small-muted">
            没有登记开放的原生 GitHub Blocking 依赖；不代表不存在潜在风险。
          </p>
        )}
        <p className="small-muted">
          关联 PR：
          {linkedPrs.length
            ? linkedPrs.map((pr) => (
                <a
                  className="inline-link"
                  key={pr.url}
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  #{pr.number}{" "}
                </a>
              ))
            : "无原生关联记录"}
        </p>
      </section>
      <section className="inspector-section">
        <div className="inspector-section-head">
          <h4>任务事实和交接</h4>
          <span className="small-muted">GitHub Issue 原始来源</span>
        </div>
        <div className="section-disclosures">
          {sections.map((section, index) => (
            <details
              key={section.title + section.content}
              open={index === 0 && sections.length < 3}
            >
              <summary>{section.title}</summary>
              <div className="markdown-reading">
                <MarkdownContent>{section.content}</MarkdownContent>
              </div>
            </details>
          ))}
          {!sections.length && (
            <p className="small-muted">没有可读取的任务正文。</p>
          )}
        </div>
        <a
          className="footnote-link"
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          查看原始任务和历史修改 ↗
        </a>
      </section>
    </aside>
  );
}

export function TaskBoard({
  parent,
}: {
  parent: IssueParent;
  repository?: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const tasks = parent.subIssues.nodes;
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return tasks
      .filter((task) => {
        const status = issueClassification(task);
        const matches =
          filter === "all" ||
          (filter === "unassigned"
            ? task.assignees.nodes.length === 0
            : status === filter);
        const searchable = [
          task.title,
          task.body,
          ...task.labels.nodes.map((label) => label.name),
        ]
          .join(" ")
          .toLocaleLowerCase();
        return matches && (!needle || searchable.includes(needle));
      })
      .sort((first, second) => {
        if (first.state !== second.state)
          return first.state === "OPEN" ? -1 : 1;
        return second.updatedAt.localeCompare(first.updatedAt);
      });
  }, [tasks, query, filter]);
  const active =
    tasks.find((item) => item.url === selected) ?? visible[0] ?? null;
  const blocked = tasks.filter(
    (item) => issueClassification(item) === "blocked",
  ).length;
  const closed = tasks.filter((item) => item.state === "CLOSED").length;

  return (
    <div className="board-layout">
      <div className="board-main">
        <div className="content-heading">
          <div>
            <p className="eyebrow">EXECUTION / WORKSTREAMS</p>
            <h2>工程任务与交接</h2>
            <p>
              真实父子 Issue、验收与阻塞。点击一行查看任务依据，不再只看标题。
            </p>
          </div>
          <a
            href={parent.url}
            className="link-action"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub 主任务 ↗
          </a>
        </div>
        <div className="facts-strip">
          <div>
            <strong>{tasks.length}</strong>
            <span>原生子任务</span>
          </div>
          <div>
            <strong>{tasks.length - closed}</strong>
            <span>仍然开放</span>
          </div>
          <div>
            <strong>{blocked}</strong>
            <span>已登记开放依赖</span>
          </div>
          <div>
            <strong>
              {tasks.filter((task) => task.assignees.nodes.length === 0).length}
            </strong>
            <span>没有指定负责人</span>
          </div>
        </div>
        <div className="board-controls">
          <label className="search-box">
            <span className="visually-hidden">搜索任务</span>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="10.5" cy="10.5" r="6.2" />
              <path d="m15 15 5.2 5.2" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、验收、任务正文…"
            />
          </label>
          <fieldset className="filter-group">
            \n <legend className="visually-hidden">任务状态筛选</legend>
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </fieldset>
        </div>
        <div className="table-wrap">
          <table className="delivery-table">
            <caption className="visually-hidden">
              原生 GitHub 工程子任务
            </caption>
            <thead>
              <tr>
                <th scope="col">事项 / 验收范围</th>
                <th scope="col">状态</th>
                <th scope="col">责任人</th>
                <th scope="col">更新</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((issue) => (
                <tr key={issue.url} data-selected={active?.url === issue.url}>
                  <td>
                    <button
                      className="task-select"
                      type="button"
                      aria-labelledby={`task-${encodeURIComponent(issue.url)}-label`}
                      onClick={() => setSelected(issue.url)}
                      aria-current={
                        active?.url === issue.url ? "true" : undefined
                      }
                    >
                      <span id={`task-${encodeURIComponent(issue.url)}-label`} className="task-label">
                        <span className="task-id">#{issue.number}</span>
                        <span className="task-name">{issue.title}</span>
                        <small>{issueSummary(issue)}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <StateText issue={issue} />
                  </td>
                  <td className="table-secondary">
                    {issue.assignees.nodes
                      .map((person) => person.login)
                      .join(", ") || "未分配"}
                  </td>
                  <td className="table-secondary">
                    {formatTime(issue.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <div className="empty-state">
              没有符合筛选条件的任务。试试更宽的关键词或状态。
            </div>
          )}
        </div>
        <p className="data-note">
          状态直接来自 GitHub
          Issue；未登记优先级、阶段或执行状态的项目不会被推断为已完成。
        </p>
      </div>
      {active ? (
        <TaskInspector key={active.url} issue={active} />
      ) : (
        <aside className="task-inspector">
          <p className="small-muted">请选择任务以查看验收和交接。</p>
        </aside>
      )}
    </div>
  );
}
