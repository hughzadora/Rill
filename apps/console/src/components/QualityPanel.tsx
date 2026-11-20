import {
  currentCheck,
  formatTime,
  type QualityProfile,
  type Workspace,
} from "../lib/model";

export function QualityPanel({
  quality,
  workspace,
}: {
  quality: QualityProfile | null;
  workspace: Workspace | null;
}) {
  const hosted = currentCheck(workspace);
  return (
    <div className="page-grid">
      <div className="content-heading">
        <div>
          <p className="eyebrow">FACTORY STANDARD / QUALITY</p>
          <h2>质量门禁与测试覆盖</h2>
          <p>
            每一个适用语言都有完整的测试层级。声明 ≠ 已执行；小样例通过 ≠
            新旧项目合规。
          </p>
        </div>
        <span className="label-outline">标准候选 · 待跨项目验收</span>
      </div>
      <div className="quality-summary">
        <div className="quality-banner">
          <span className="eyebrow">当前工作分支 Hosted CI</span>
          <strong>
            {!hosted
              ? "当前提交暂无托管执行记录"
              : hosted.conclusion === "success"
                ? "当前提交的工作流成功"
                : hosted.status === "in_progress"
                  ? "当前提交正在运行"
                  : "当前提交检查未通过 / 未完成"}
          </strong>
          <p>
            {hosted
              ? "来源：" + hosted.name + " · " + formatTime(hosted.createdAt)
              : "不能把旧提交、局部脚本或 fixture 结果继承为当前候选的通过状态。"}
          </p>
          {hosted && (
            <a
              href={hosted.url}
              target="_blank"
              rel="noopener noreferrer"
              className="link-action"
            >
              查看运行记录 ↗
            </a>
          )}
        </div>
        <div className="quality-explainer">
          <p className="eyebrow">证据分级</p>
          <ol>
            <li>规范已声明：仅是要求</li>
            <li>局部工具运行：限定到被测试源码</li>
            <li>当前候选 CI：关联精确 SHA</li>
            <li>真实集成 + 人工操作：产品级验收</li>
          </ol>
        </div>
      </div>
      <section
        className="quality-matrix-section"
        aria-labelledby="quality-matrix-title"
      >
        <div className="section-bar">
          <div>
            <h3 id="quality-matrix-title">四种技术栈 · 适用门禁矩阵</h3>
            <p>此表是必须实现的要求，不是虚构的测试结果。</p>
          </div>
          <a
            href="/api/document?path=README.md"
            className="link-action"
            target="_blank"
            rel="noopener noreferrer"
          >
            规范原文 ↗
          </a>
        </div>
        {quality ? (
          <div className="matrix-scroll">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th scope="col">技术栈</th>
                  {quality.layers.map((layer) => (
                    <th key={layer.id} scope="col">
                      {layer.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quality.stacks.map((stack) => (
                  <tr key={stack.id}>
                    <th scope="row">
                      <strong>{stack.label}</strong>
                      <small>{stack.profile}</small>
                    </th>
                    {quality.layers.map((layer) => (
                      <td key={layer.id}>
                        <span
                          className={
                            stack.layers.includes(layer.id)
                              ? "gate-required"
                              : "gate-na"
                          }
                          title={
                            stack.layers.includes(layer.id)
                              ? "适用，尚未在此目标项目验证"
                              : "此类项目通常不适用"
                          }
                        >
                          {stack.layers.includes(layer.id) ? "待验证" : "—"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            质量规范暂不可读取。不能把缺失配置视为通过。
          </div>
        )}
      </section>
      <div className="two-columns">
        <section className="simple-panel">
          <p className="eyebrow">MAINTAINED TOOLING</p>
          <h3>已声明的上游工具</h3>
          {quality?.stacks.map((stack) => (
            <div className="tool-row" key={stack.id}>
              <strong>{stack.label}</strong>
              <p>{stack.tools.join(" · ")}</p>
            </div>
          ))}
        </section>
        <section className="simple-panel">
          <p className="eyebrow">RELEASE PROOF</p>
          <h3>仍需通过的工厂验收</h3>
          <ul className="gate-todo">
            <li>真实 React/Tailwind 产品的组件、无障碍与浏览器测试</li>
            <li>Node/API、Python 集成与 Shell 负例</li>
            <li>新项目 + 既有项目实际接入与非破坏性回滚</li>
            <li>每项质量门禁都可追溯当前源码和运行记录</li>
            <li>独立代码审查、最终用户操作与受保护的 PR</li>
          </ul>
          <p className="data-note">
            上述项目未全部验收，不能宣称 Rill 标准已经发行。
          </p>
        </section>
      </div>
    </div>
  );
}
