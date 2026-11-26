# Rill

Rill is a versioned AI-DLC workflow for Codex. Describe your product in plain language and use the resulting prototype, native check results, and review evidence to decide whether it is ready.

## Use Rill

1. Download the archive for your profile and its checksum file from the [Rill releases](https://github.com/hughzadora/rill/releases). Choose a specific version and keep that version with your project.
2. In the download directory, check the archive with `shasum -a 256 -c <archive>.sha256` or `sha256sum -c <archive>.sha256`. Extract it into an empty project directory. Ask Codex to handle verification and extraction if you prefer.
3. Open the project directory in Codex and say `用 Rill 开始：〈一句话描述想做的产品〉`, or explicitly select the `rill` skill.
4. Review the first working journey and its acceptance evidence. Ask `用 Rill 继续` or `用 Rill 验证当前版本` to resume or review a change.

The [delivery workflow](workflow/DELIVERY.md) identifies the stages. The [blueprint](modern-ai-dlc-engineering-master-blueprint.md) defines the checks activated by your project's actual scope.

## Build the template

Install mise, run `mise install --locked`, then `mise exec -- bun install --frozen-lockfile`. From a temporary checkout of the Rill source repository, `mise run build` produces the versioned base template, the available profile templates, and their checksum files in `dist/`. The builder selects tracked template files.
