import { currentCheck, type Dashboard, formatTime } from "../lib/model";

export function Overview({
  data,
  onNavigate,
}: {
  data: Dashboard;
  onNavigate: (
    route: "work" | "pipeline" | "quality" | "docs" | "handoff",
  ) => void;
}) {
  const issueData = data.issueData;
  const workspace = data.workspace;
  const issues = issueData?.parent?.subIssues.nodes ?? [];
  const bugs = issueData?.bugs?.subIssues.nodes ?? [];
  const hosted = currentCheck(workspace);
  return (
    <div className="page-grid">
      <div className="content-heading home-intro">
        <div>
          <p className="eyebrow">SOFTWARE FACTORY / CURRENT REPOSITORY</p>
          <h2>把开发流程变成可验证的生产线</h2>
          <p>
            Rill
            是给未来新项目和既有项目使用的通用交付标准。这里展示当前工厂自身的工程状态，而不是某个业务应用的开发看板。
          </p>
        </div>
        <span className="label-outline">Factory Candidate · 尚未发布</span>
      </div>
      <div className="overview-banner">
        <div>
          <p className="eyebrow">当前项目 · GitHub 原生来源</p>
          <h3>{issueData?.parent.title ?? "项目任务暂不可用"}</h3>
          <p>
            本仓库只是 Rill
            标准的研发与验证场。跨项目安装、升级、回滚与真实软件交付尚需分别验收。
          </p>
          <div className="banner-actions">
            <button type="button" onClick={() => onNavigate("work")}>
              进入工程执行台
            </button>
            <button type="button" onClick={() => onNavigate("quality")}>
              查看质量门禁
            </button>
          </div>
        </div>
        <div className="banner-truth">
          <span>验收结论</span>
          <strong>未达到正式工业交付标准</strong>
          <small>
            不能用局部 fixture、一个绿色 CI 或页面原型取代真实跨项目验收。
          </small>
        </div>
      </div>
      <div className="overview-stats">
        <div>
          <small>开放工程任务</small>
          <strong>
            {issueData
              ? issues.filter((item) => item.state === "OPEN").length
              : "—"}
          </strong>
          <p>原生子 Issue</p>
        </div>
        <div>
          <small>待解决 Bug</small>
          <strong>
            {issueData
              ? bugs.filter((item) => item.state === "OPEN").length
              : "—"}
          </strong>
          <p>永久 Bug 台账</p>
        </div>
        <div>
          <small>当前源码</small>
          <strong>{workspace ? workspace.sha.slice(0, 7) : "—"}</strong>
          <p>
            {workspace?.dirty
              ? workspace.changedPaths + " 个待提交修改"
              : "Git 工作树干净或未读取"}
          </p>
        </div>
        <div>
          <small>托管质量检查</small>
          <strong className="stats-word">
            {hosted ? hosted.conclusion || hosted.status : "未知"}
          </strong>
          <p>{hosted ? "已绑定当前 SHA" : "未发现当前提交的 CI"}</p>
        </div>
      </div>
      <div className="two-columns">
        <section className="simple-panel">
          <div className="section-bar">
            <div>
              <p className="eyebrow">IN PROGRESS</p>
              <h3>正在处理的工作流</h3>
            </div>
            <button
              type="button"
              className="text-action"
              onClick={() => onNavigate("work")}
            >
              全部任务 ↗
            </button>
          </div>
          {issues.slice(0, 5).map((issue) => (
            <a
              className="work-item"
              key={issue.number}
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="task-id">#{issue.number}</span>
              <span>{issue.title}</span>
              <small>{issue.state === "OPEN" ? "开放" : "关闭"}</small>
            </a>
          ))}
          {!issues.length && (
            <p className="small-muted">GitHub 任务来源尚未可读。</p>
          )}
        </section>
        <section className="simple-panel">
          <div className="section-bar">
            <div>
              <p className="eyebrow">PROCESS READINESS</p>
              <h3>三项真正的交付前提</h3>
            </div>
          </div>
          <div className="readiness-item">
            <span>01</span>
            <div>
              <strong>可复用的标准定义</strong>
              <p>
                需求、角色、质量矩阵、架构与交接文件齐全；还需真实目标接入。
              </p>
            </div>
            <small>已配置</small>
          </div>
          <div className="readiness-item">
            <span>02</span>
            <div>
              <strong>新项目与旧项目实测</strong>
              <p>
                代码质量不等于标准已安装；需要两个完整目标项目的实际运行证据。
              </p>
            </div>
            <small>待验证</small>
          </div>
          <div className="readiness-item">
            <span>03</span>
            <div>
              <strong>独立审查与 Owner 验收</strong>
              <p>人实际点功能、审查当前 SHA、验证 PR 和回滚，再发布标准。</p>
            </div>
            <small>待验证</small>
          </div>
          <button
            type="button"
            className="text-action"
            onClick={() => onNavigate("pipeline")}
          >
            浏览全部交付阶段 ↗
          </button>
        </section>
      </div>
      <section className="factory-intake">
        <div>
          <p className="eyebrow">PORTFOLIO / STANDARD ADOPTION</p>
          <h3>下一座软件工厂：新项目或接手旧项目</h3>
          <p>
            Rill 的目的不是为自己维护一个 Issue
            看板，而是以同一标准交付不同项目。接入执行入口尚未发布，当前可检查正式规范与质量要求。
          </p>
        </div>
        <div className="intake-options">
          <button type="button" onClick={() => onNavigate("docs")}>
            <strong>新项目</strong>
            <span>需求 → 框架 → 质量门禁 → 首次交付</span>
            <small>查看标准</small>
          </button>
          <button type="button" onClick={() => onNavigate("handoff")}>
            <strong>已有项目</strong>
            <span>现状审计 → 保留上游 → 差距补齐 → 回滚验收</span>
            <small>查看接手要求</small>
          </button>
        </div>
      </section>
      <p className="data-note">
        最近状态查询：{formatTime(data.fetchedAt)} · 仅展示已读取的 GitHub
        与本地 Git 证据。缺失值不是通过。
      </p>
    </div>
  );
}
