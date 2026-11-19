import { useState } from "react";

const phases = [
  {
    name: "需求与验收",
    owner: "Owner + Agent",
    artifact: "产品目标、范围、正反向验收条件",
    check: "要求完整，来源可追溯",
  },
  {
    name: "快速可点原型",
    owner: "Agent → Owner",
    artifact: "真正能点击的主要用户路径与截图",
    check: "你亲自检查原型体验",
  },
  {
    name: "完整设计与取舍",
    owner: "Agent → Native choice",
    artifact: "可视化模块、数据流、风险和替代方案",
    check: "重大取舍通过 Harness 原生选项",
  },
  {
    name: "Agent 实现",
    owner: "Worker + Explorer",
    artifact: "实际代码、旧测试回归、可运行构建",
    check: "不在此阶段伪造完成或跳过旧测试",
  },
  {
    name: "集成与用户测试",
    owner: "Agent + Owner",
    artifact: "接口、真实系统、Chrome/桌面交互",
    check: "关键正向和失败路径真实运行",
  },
  {
    name: "清理和单元测试",
    owner: "Worker",
    artifact: "去废弃、降复杂度、补注释与单测",
    check: "源码边界、测试失效保护和结构审计",
  },
  {
    name: "二次复测与人工检查",
    owner: "CI + Reviewer + Owner",
    artifact: "完整门禁、独立审查、截图及实际点击",
    check: "当前 SHA 复测，Owner 检查真实结果",
  },
  {
    name: "PR 与交付",
    owner: "Coordinator",
    artifact: "可审查 PR、CI、批准和回滚说明",
    check: "没有授权不能合并或发布",
  },
];

const designRoutes = [
  {
    name: "原生交付标准",
    status: "当前采用",
    source: "Codex Harness + GitHub 原生 Issue/PR + Copier 版本化标准",
    evidence: "任务来源唯一；CI 绑定精确 SHA；安装和回滚都由 Git 记录。",
    limitation: "原生授权及 Owner 最终点击仍需真实平台交互。",
    verdict: "减少维护的自建状态；风险和版本归属可以独立审查。",
  },
  {
    name: "自建 Agent 运行时",
    status: "已废弃",
    source: "自定义 Hook、任务快照、上下文恢复与并行状态服务",
    evidence: "以前曾有实现，但与 Harness 的会话和授权事实重叠。",
    limitation: "第二份任务真相、升级负担和权限边界无法自动验证。",
    verdict: "原生功能已覆盖的部分直接删除，不保留兼容层。",
  },
  {
    name: "复制文档模板",
    status: "不满足验收",
    source: "仅在项目中放置 Markdown 说明与 Prompt",
    evidence: "入门简单，但规范没有落实到真实源码、测试和构建。",
    limitation: "不能证明代码通过质量门禁，也不产生可复测的交付记录。",
    verdict: "文档只能解释标准；实际约束由语言工具和托管 CI 强制执行。",
  },
];

export function Pipeline({
  onNavigate,
}: {
  onNavigate: (view: "quality" | "docs") => void;
}) {
  const [selected, setSelected] = useState(0);
  const [compared, setCompared] = useState(0);
  const current = phases[selected];
  const route = designRoutes[compared];
  return (
    <div className="page-grid">
      <div className="content-heading">
        <div>
          <p className="eyebrow">FACTORY / DELIVERY PROCESS</p>
          <h2>标准化软件交付流水线</h2>
          <p>
            不是每一条任务必须八张表；这是大功能必须可复核的生产流程。当前具体项目的阶段仍以真实任务证据为准。
          </p>
        </div>
        <span className="label-outline">8 个阶段 · 3 次人工检查</span>
      </div>
      <div className="pipeline-content">
        <ol className="pipeline-track" aria-label="交付流程阶段">
          {phases.map((phase, index) => (
            <li key={phase.name}>
              <button
                type="button"
                aria-current={selected === index ? "step" : undefined}
                onClick={() => setSelected(index)}
              >
                <span className="phase-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="phase-name">
                  {phase.name}
                  <small>{phase.owner}</small>
                </span>
                <span className="phase-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="phase-detail">
          <p className="eyebrow">
            STAGE {String(selected + 1).padStart(2, "0")} / 08
          </p>
          <h3>{current.name}</h3>
          <p className="phase-body">
            此阶段应产出可独立检查的产品或工程证据。所列内容是要求，尚不代表当前项目已经通过。
          </p>
          <div className="phase-deliverable">
            <span>必须交付的实物</span>
            <strong>{current.artifact}</strong>
          </div>
          <div className="phase-deliverable">
            <span>验收条件</span>
            <strong>{current.check}</strong>
          </div>
          <div className="phase-next">
            <button type="button" onClick={() => onNavigate("quality")}>
              查看完整质量矩阵
            </button>
            <button type="button" onClick={() => onNavigate("docs")}>
              查看正式工程规范
            </button>
          </div>
        </div>
      </div>
      {selected === 2 && (
        <section
          className="decision-comparison"
          aria-labelledby="route-comparison-title"
        >
          <div className="section-bar">
            <div>
              <h3 id="route-comparison-title">架构方案对照</h3>
              <p>
                这是 Rill 已确定架构的设计依据。切换只改变解释，不会替代 Harness
                原生选择、保存决定或触发 Agent。
              </p>
            </div>
          </div>
          <div className="decision-comparison-options">
            {designRoutes.map((alternative, index) => (
              <button
                key={alternative.name}
                type="button"
                aria-pressed={compared === index}
                onClick={() => setCompared(index)}
              >
                <strong>{alternative.name}</strong>
                <span>{alternative.status}</span>
              </button>
            ))}
          </div>
          <div className="decision-comparison-detail" aria-live="polite">
            <dl>
              <div>
                <dt>实现边界</dt>
                <dd>{route.source}</dd>
              </div>
              <div>
                <dt>可验证的收益</dt>
                <dd>{route.evidence}</dd>
              </div>
              <div>
                <dt>代价与局限</dt>
                <dd>{route.limitation}</dd>
              </div>
            </dl>
            <p>{route.verdict}</p>
          </div>
        </section>
      )}
      <section
        className="checkpoints-section"
        aria-labelledby="checkpoints-title"
      >
        <div className="section-bar">
          <div>
            <h3 id="checkpoints-title">人只在关键环节判断</h3>
            <p>Agent 可以持续迭代，但验收事实不能自说自话。</p>
          </div>
        </div>
        <div className="checkpoints-grid">
          {[
            [
              "01",
              "原型体验",
              "真实点击用户路径，指出方向和使用摩擦",
              "不能用静态截图代替交互",
            ],
            [
              "02",
              "总体设计",
              "比较重大模块/数据/成本取舍",
              "必须使用真正的 Harness 原生选择",
            ],
            [
              "03",
              "最终功能",
              "先检查可复测证据，再亲自操作",
              "没有独立审查与全量门禁就不进入交付",
            ],
          ].map(([number, title, detail, caveat]) => (
            <div key={number} className="owner-checkpoint">
              <span>{number}</span>
              <h4>{title}</h4>
              <p>{detail}</p>
              <small>{caveat}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
