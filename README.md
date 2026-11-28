# Rill

Rill is a GitHub repository template for agents building new TypeScript projects with [GitHub Spec Kit](https://github.com/github/spec-kit) and Oh My Pi (OMP). It starts with an empty `packages/` workspace.

## Start a project

1. Create a repository from this template and clone it.
2. Install [mise](https://mise.jdx.dev/) and [OMP](https://github.com/can1357/oh-my-pi). Review and trust the mise configuration, then run `mise install --locked`.
3. Run `mise run verify`. GitHub Actions uses the same command on pull requests and pushes to `main`.
4. Give OMP a product request. Use `/speckit.specify`, `/speckit.plan`, `/speckit.tasks` and `/speckit.implement`, or run `mise exec -- specify workflow run speckit --input 'spec=Describe the requested behavior'`. Review each artifact before resuming its workflow gate. Use `specify workflow info assess` for the idea assessment workflow.

## Add a package

Scaffold a package under `packages/` with maintained tools. Give it `build`, `typecheck` and `test` scripts. Use `tsrs --noEmit -p tsconfig.json` for type checking with a package-local configuration extending the root `tsconfig.json`. Refresh the Bun lockfile with `bun install` when workspace manifests change. Run `mise run verify` before committing.

For packages tested with `bun:test`, keep `@types/bun` in the package's `devDependencies` and set `"types": ["bun"]` in its `tsconfig.json` under `compilerOptions`. This loads Bun's type declarations during the package's type check.

The repository-wide rules live in [the constitution](.specify/memory/constitution.md).
