---
id: ADR-001
title: Rill Architecture & Invariants
status: active
superseded_by:
last_updated: 2026-11-27
related_code:
  - tsconfig.json
  - .oxfmtrc.json
  - .oxlintrc.json
  - knip.json
  - src/template.ts
---

# Rill Architecture

本文件定义 Rill 仓库自身的架构边界与类型检查契约，供 Agent 在对本仓库进行修改时遵循。

## 依赖方向（固定）

- `src/template.ts`：构建与打包入口，不依赖任何内部业务模块。
- `tests/tooling/`：工具契约测试（run-suite、gates、workflow、repository），仅依赖 `src/template.ts` 的公开导出与 `bun:test`。
- `tests/behavior/`：行为测试，仅依赖已构建的 release kit 与 `bun:test`。
- `template/`：消费者侧模板，不被 Rill 源码导入，仅随 kit 打包分发。
- 不得在 `src/` 中引入 `template/`、`tests/`、`docs/`、`workflow/` 等非源码目录的模块。

## 类型检查（tsrs 唯一权威）

- `tsconfig.json` 为单一类型检查配置，`types: ["bun"]`，`module: "Preserve"`，`moduleResolution: "Bundler"`，`target: "ES2022"`。
- `TSRS_FAST=0`，禁止使用速度模式改变诊断结果。
- Oxlint 的 `--type-aware` 后端使用 tsrs，禁止安装 `oxlint-tsgolint` 作为第二个检查器。
- `bun test` / `bun run build` 成功不替代 `tsrs --noEmit`。

## 格式化（Oxfmt 单一所有者）

- `.oxfmtrc.json` 为唯一格式化配置，忽略 `bun.lock`、`mise.lock`、`node_modules/**`、`dist/**`、`reports/**`、蓝图文件。
- 不得在同一文件范围内启用第二个格式化工具（Biome/Prettier）。

## 静态检查（Oxlint 显式安全规则）

- `.oxlintrc.json` 启用 `typescript`/`import`/`unicorn`/`jest` 插件，`correctness` 为 `error`。
- 禁止 `any`、unsafe 赋值/参数/调用/成员访问/类型断言、floating promises、TS 注释抑制、全局赋值、隐式全局、空块、焦点/禁用测试。
- 如原生规则不覆盖的特定语法缺口，使用 `sgconfig.yml` 的 ast-grep 规则补齐，不重复实现同一验收条件。

## 死码零容忍（knip）

- `knip.json` 入口：`src/template.ts`、`src/**/*.ts`、`tests/**/*.ts`；项目范围相同；忽略 `template/**`、`dist/**`、`rill-test-project/**`。
- 每次迭代结束前运行 `bunx knip`，孤立文件/未用导出必须清理，不得保留 `funcV2` 与旧函数并存。

## Git 工作树

- 工作树位于 `.worktrees/`，非主工作树。
- 删除前 `git status --porcelain` 必须为空；分支 tip 必须是 base 的祖先。
- 合并后用 `git branch -d`（禁止 `-D`）；锁定后 `git worktree lock`，完成后显式 `unlock`；禁止 `git worktree remove --force`。
