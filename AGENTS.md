# Rill

> Owner taste: read [OWNER_TASTE.md](OWNER_TASTE.md) before writing any document, issue, PR, plan, or goal; every artifact must be produced explicitly with writing-for-agents.
> SOLE OPERATIONAL AUTHORITY: read [docs/ADLC_MASTER.md](docs/ADLC_MASTER.md) before any code change. It is the zero-friction execution contract; AGENTS.md only points to it and to domain docs below.

Read the [Rill product brief](docs/PROJECT.md) for scope and acceptance, and the relevant sections of the [engineering blueprint](modern-ai-dlc-engineering-master-blueprint.md) for execution. Use the [Rill workflow](workflow/DELIVERY.md) when exercising the repository skill or checking the adopted template. Architecture and design constraints are in [ARCHITECTURE.md](ARCHITECTURE.md) and [DESIGN.md](DESIGN.md).

## Agent skills

### Root cause first (blueprint 6.1)

遇到测试失败或类型报错时，禁止直接输出代码补丁。必须先输出三句因果分析：
`[报错根因] -> [受影响的上下游模块] -> [为什么不能用局部硬编码/特判解决]`，强制激活逻辑推理而非统计学盲猜。

### Intent → 机器语言转换网关（防补丁式作弊）

代码生成前，必须先将用户自然语言意图转换为标准机器语言规范（输入/输出、边界、不变式、失败模式），再写代码。用户意图不得直接作为硬编码字符串写入源码（如“买菜清单”“没信号”）。违规将被静态检查拦截。

### 测试断言隔离（blueprint 6.2）

修复 Bug 时，默认无权修改既有 `*.test.ts` 中的断言条件，除非能证明业务需求本身已变更。PR 审查通过 `difftastic` 结构 diff 一眼识别违规篡改测试的行为。

### 死码零容忍（blueprint 6.3，knip）

每次迭代结束前运行 `bunx knip`。孤立文件/未用导出必须清理，不得保留 `funcV2` 与旧函数并存。

### Git 工作树生命周期

工作树位于 `.worktrees/`，非主工作树。删除前 `git status --porcelain` 必须为空；分支 tip 必须是 base 的祖先。合并后用 `git branch -d`（禁止 `-D`）；锁定后 `git worktree lock`，完成后显式 `unlock`；禁止 `git worktree remove --force`。

### Issue tracker

For specs, tickets, dependencies, or closure, see [GitHub issue tracker](docs/agents/issue-tracker.md).

### Triage labels

When triaging issues, use the [default label mapping](docs/agents/triage-labels.md).

### Domain docs

When exploring the codebase or making a domain decision, follow the [single-context layout](docs/agents/domain.md).
