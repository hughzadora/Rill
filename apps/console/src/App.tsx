import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { DocsPanel } from "./components/DocsPanel";
import { Overview } from "./components/Overview";
import { Pipeline } from "./components/Pipeline";
import { QualityPanel } from "./components/QualityPanel";
import { TaskBoard } from "./components/TaskBoard";
import {
  currentCheck,
  type Dashboard,
  formatTime,
  issueClassification,
  validateDashboard,
} from "./lib/model";

type View = "overview" | "work" | "pipeline" | "quality" | "docs" | "handoff";
const navigation: { view: View; title: string; note: string }[] = [
  { view: "overview", title: "生产总览", note: "工厂和项目态势" },
  { view: "work", title: "任务执行台", note: "事项与交接" },
  { view: "pipeline", title: "软件流水线", note: "阶段与人机协作" },
  { view: "quality", title: "质量实验室", note: "适用门禁与证据" },
  { view: "docs", title: "工程文档", note: "需求与规范" },
  { view: "handoff", title: "交付交接", note: "候选、CI、风险" },
];

function Handoff({
  data,
  onNavigate,
}: {
  data: Dashboard;
  onNavigate: (view: View) => void;
}) {
  const work = data.workspace;
  const issue = data.issueData;
  const candidate = currentCheck(work ?? null);
  const nextIssue = issue?.parent.subIssues.nodes.find(
    (item) => issueClassification(item) === "open",
  );
  const blockedWork = issue?.parent.subIssues.nodes.some(
    (item) => issueClassification(item) === "blocked",
  );
  return (
    <div className="page-grid">
      <div className="content-heading">
        <div>
          <p className="eyebrow">CONTINUITY / DELIVERY RECEIPT</p>
          <h2>下一位 Agent 能不能直接接手？</h2>
          <p>
            以下只展示可从当前 Git、GitHub
            和正式文档恢复的事实，不保存会话摘要，也不生成虚假的开发进度。
          </p>
        </div>
      </div>
      <div className="handoff-hero">
        <div>
          <p className="eyebrow">CURRENT CANDIDATE</p>
          <strong>{work?.sha.slice(0, 12) ?? "候选未知"}</strong>
          <p>
            {work?.branch ?? "分支未知"} ·{" "}
            {work?.dirty
              ? "存在 " + work.changedPaths + " 项待提交改动"
              : "无已观察到的本地修改"}
          </p>
        </div>
        <span className="label-outline">
          {candidate
            ? "托管执行：" + (candidate.conclusion || candidate.status)
            : "当前提交暂无托管执行证明"}
        </span>
      </div>
      <div className="two-columns">
        <section className="simple-panel">
          <p className="eyebrow">SOURCE-OF-TRUTH INDEX</p>
          <h3>真实交接来源</h3>
          <ol className="handoff-list">
            <li>
              <strong>产品契约</strong>
              <span>PRD + Architecture + Design</span>
              <button onClick={() => onNavigate("docs")} type="button">
                查看文档
              </button>
            </li>
            <li>
              <strong>当前工作范围</strong>
              <span>{issue?.parent.title ?? "GitHub 父任务未读取"}</span>
              {issue && (
                <a
                  href={issue.parent.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  原生 Issue ↗
                </a>
              )}
            </li>
            <li>
              <strong>未标记阻塞的开放事项（仍需验收与授权核对）</strong>
              <span>
                {nextIssue
                  ? "#" + nextIssue.number + " · " + nextIssue.title
                  : blockedWork
                    ? "现有开放任务均受依赖阻塞，先查看阻塞条件"
                    : "尚无可确认的开放子任务"}
              </span>
              <button onClick={() => onNavigate("work")} type="button">
                查看验收和阻塞
              </button>
            </li>
            <li>
              <strong>质量与发布证据</strong>
              <span>
                {candidate
                  ? "存在与当前 SHA 相同的托管运行"
                  : "当前 SHA 的 CI 尚无可用证明"}
              </span>
              <button onClick={() => onNavigate("quality")} type="button">
                查看门禁
              </button>
            </li>
          </ol>
        </section>
        <section className="simple-panel">
          <p className="eyebrow">HANDOFF GAPS</p>
          <h3>不得交给下一位 Agent 猜的事实</h3>
          <ul className="gate-todo">
            <li>Owner 对原型和整体设计的真实验收结果</li>
            <li>独立 Reviewer 对最终候选的审查</li>
            <li>React/Node/Python/Shell 全部适用的真实目标检查</li>
            <li>新项目与旧项目标准安装、升级与回滚</li>
            <li>旧用户级 Rill 插件隔离的原生会话复验</li>
          </ul>
          <p className="data-note">
            这些是当前标准尚未取得的证据，不等于任务一定都未开始。以原生 Issue
            的新证据为准。
          </p>
        </section>
      </div>
      <section className="simple-panel">
        <div className="section-bar">
          <div>
            <p className="eyebrow">NATIVE PULL REQUESTS</p>
            <h3>提交与代码审查</h3>
          </div>
        </div>
        {work?.prs?.length ? (
          <ul className="native-link-list">
            {work.prs.map((pr) => (
              <li key={pr.number}>
                <a href={pr.url} target="_blank" rel="noopener noreferrer">
                  #{pr.number} · {pr.title}
                </a>
                <span>
                  {pr.state}
                  {pr.isDraft ? " · 草稿" : ""}
                </span>
                <small>{formatTime(pr.updatedAt)}</small>
              </li>
            ))}
          </ul>
        ) : (
          <div className="unknown-block">
            当前分支没有可确认的 PR 记录。尚不能宣称交付、合并或发布。
          </div>
        )}
      </section>
    </div>
  );
}

function AppFrame({
  children,
  view,
  onNavigate,
  data,
  fetching,
  error,
  onRefresh,
}: {
  children: ReactNode;
  view: View;
  onNavigate: (view: View) => void;
  data: Dashboard | null;
  fetching: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const issue = data?.issueData;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-area">
          <div className="rill-logo" aria-hidden="true">
            R
          </div>
          <div>
            <strong>Rill</strong>
            <span>Industrial Delivery</span>
          </div>
        </div>
        <div className="sidebar-caption">SOFTWARE FACTORY</div>
        <nav aria-label="工程功能导航" className="main-nav">
          {navigation.map((item, index) => (
            <button
              key={item.view}
              type="button"
              aria-current={view === item.view ? "page" : undefined}
              onClick={() => onNavigate(item.view)}
            >
              <span className="nav-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.note}</small>
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-key">当前资料来源</div>
          <div className="sidebar-repository">
            {issue?.nameWithOwner ?? "GitHub 尚未同步"}
          </div>
          <p>
            原生 GitHub + 当前 Git。无复制型任务数据库，也不接管 Harness 审批。
          </p>
          <a
            href="https://github.com/hughzadora/Rill/issues/22"
            target="_blank"
            rel="noopener noreferrer"
          >
            工程主任务 ↗
          </a>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <strong>
              Rill / {navigation.find((item) => item.view === view)?.title}
            </strong>
            <span>{issue?.nameWithOwner ?? "等待项目来源"}</span>
          </div>
          <div className="top-actions">
            <span className="source-time">
              {data ? "更新于 " + formatTime(data.fetchedAt) : "尚未同步"}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={fetching}
              className="refresh-button"
            >
              {fetching ? "正在核对…" : "刷新真实状态"}
            </button>
          </div>
        </header>
        {error && (
          <div className="error-banner" role="status">
            {error}。现有界面数据可能过时；缺失项一律不视为通过。
          </div>
        )}
        <main id="main-content" className="content-area">
          {children}
        </main>
        <footer className="app-footer">
          <span>Rill standard / candidate · GitHub native truth</span>
          <span>HTML 只负责可视化，授权仍属原生 Harness</span>
        </footer>
      </div>
    </div>
  );
}

export function App() {
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<Dashboard | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  const loadDashboard = useCallback(() => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setFetching(true);
    void (async () => {
      try {
        const response = await fetch("/api/dashboard", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("本地看板接口不可用");
        const value: unknown = await response.json();
        if (!validateDashboard(value)) {
          throw new Error("返回的项目状态不完整或格式错误");
        }
        if (controller.signal.aborted) return;
        setData(value);
        setError(value.errors.length ? value.errors.join("；") : null);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(
            "本次同步失败：" +
              (reason instanceof Error ? reason.message : "未知错误"),
          );
        }
      } finally {
        if (!controller.signal.aborted) setFetching(false);
      }
    })();
    return controller;
  }, []);

  useEffect(() => {
    const controller = loadDashboard();
    return () => controller.abort();
  }, [loadDashboard]);

  let content: ReactNode;
  if (!data) {
    content = (
      <div className="page-grid initial-state" role="status">
        <p className="eyebrow">ENGINEERING SOURCES</p>
        <h1>{fetching ? "读取项目交付事实…" : "当前没有可核实的项目事实"}</h1>
        <p>若 GitHub 暂时不可用，不能用标题快照或者历史 CI 冒充最新状态。</p>
      </div>
    );
  } else {
    switch (view) {
      case "overview":
        content = <Overview data={data} onNavigate={setView} />;
        break;
      case "work":
        content = data.issueData ? (
          <TaskBoard
            parent={data.issueData.parent}
            repository={data.issueData.nameWithOwner}
          />
        ) : (
          <div className="empty-state">
            GitHub 任务源暂不可用。请检查网络或授权。
          </div>
        );
        break;
      case "pipeline":
        content = <Pipeline onNavigate={setView} />;
        break;
      case "quality":
        content = (
          <QualityPanel quality={data.quality} workspace={data.workspace} />
        );
        break;
      case "docs":
        content = <DocsPanel documents={data.documents} />;
        break;
      case "handoff":
        content = <Handoff data={data} onNavigate={setView} />;
        break;
    }
  }
  return (
    <AppFrame
      view={view}
      onNavigate={setView}
      data={data}
      fetching={fetching}
      error={error}
      onRefresh={loadDashboard}
    >
      {content}
    </AppFrame>
  );
}
