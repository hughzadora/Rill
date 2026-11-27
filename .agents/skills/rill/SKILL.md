---
name: rill
description: In an adopted Rill workspace, use for a user's plain-language request to build or improve a product, or for a request to verify, release, or recover it. Also use when the user names or selects Rill. Follow the root-cause-first, intent-to-machine-spec, and no-hardcoded-intent rules in AGENTS.md and DESIGN.md.
---

# Rill

1. Open [Delivery](../../../workflow/DELIVERY.md) for every invocation. Resolve the selected workspace, current product brief, Git state, and next observable outcome there. Ask in the user's language only for a consequential missing fact, target, or authorization.
2. Follow the stage links from Delivery. Use the profile routes when scope or source activates a gate, candidate acceptance when verifying or hardening, and release and recovery when the user requests those actions or an authorized release fails.
3. Run the native tasks on the actual inputs and use the [blueprint](../../../modern-ai-dlc-engineering-master-blueprint.md) for exact requirements and exit conditions. Return what the user can try, the evidence for that result, and any incomplete requirement.

## Root cause first (blueprint 6.1)

遇到测试失败或类型报错时，禁止直接输出代码补丁。必须先输出三句因果分析：
`[报错根因] -> [受影响的上下游模块] -> [为什么不能用局部硬编码/特判解决]`。

## Intent → 机器语言转换网关（防补丁式作弊）

代码生成前，必须先将用户自然语言意图转换为标准机器语言规范（输入/输出、边界、不变式、失败模式），再写代码。用户意图不得直接作为硬编码字符串写入源码（如“买菜清单”“没信号”）。

## 测试断言隔离（blueprint 6.2）

修复 Bug 时，默认无权修改既有 `*.test.ts` 中的断言条件，除非能证明业务需求本身已变更。PR 审查通过 `difftastic` 结构 diff 一眼识别违规篡改测试的行为。

## 死码零容忍（blueprint 6.3，knip）

每次迭代结束前运行 `bunx knip`。孤立文件/未用导出必须清理，不得保留 `funcV2` 与旧函数并存。
