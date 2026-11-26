# Rill

Rill is a versioned AI-DLC workflow for Codex. Describe your product in plain language and use the resulting prototype, native check results, and review evidence to decide whether it is ready.

## Use Rill

1. Take the archive for the Rill version you want. Extract it into an empty directory and initialize Git in that directory if your workspace has not already done so.
2. Open the directory in Codex and say `用 Rill 开始：〈一句话描述想做的产品〉`, or explicitly select the `rill` skill.
3. Review the first working journey and its acceptance evidence. Ask `用 Rill 继续` or `用 Rill 验证当前版本` to resume or review a change.

The [delivery workflow](workflow/DELIVERY.md) identifies the stages. The [blueprint](modern-ai-dlc-engineering-master-blueprint.md) defines the checks activated by your project's actual scope.

## Build the template

Install mise, run `mise install --locked`, then `mise exec -- bun install --frozen-lockfile`. From a Git checkout, `mise run build` produces the versioned base template and the available profile templates in `dist/`. The builder selects tracked template files.
