# Rill architecture

## System boundary

Rill is a local preference and task-control plugin. Codex owns session lifecycle, permissions, approval UI, native interaction, and scheduling. GitHub owns approved decisions and task history. The repository contains project configuration and source; a Git-associated recovery directory contains synchronized task cache and pending local records. Rill does not maintain a separate session service or task database.

```text
Codex native session and permissions
  ├── lifecycle / tool hooks ──> tools/control-hook.ts
  │                              └── tools/recovery-lifecycle.ts
  │                                  ├── task-context.ts (identity/cache/outbox/GitHub)
  │                                  ├── recovery-state.ts (gaps and recovery reports)
  │                                  ├── repair-evidence.ts (repair state and guard)
  │                                  └── delivery-evidence.ts (candidate acceptance guard)
  └── MCP client ──────────────> tools/control-mcp.ts
                                  ├── task sync, record, publish, recover
                                  ├── decision source and CI evidence
                                  ├── repair evidence
                                  └── delivery audit/status/retraction

GitHub issue/comments <── task-context.ts
Native thread history <── native-history.ts <── recover-task.ts
Project enrollment ────> .rill identity + native plugin config
```

## Source status and authority

Issue #18 is the current active engineering delivery and acceptance authority;
permanent exploration Issue #10 remains open by explicit owner decision. Prior
candidate design and quality research remain in GitHub PR/Issue history. The
root native plugin's behavior tests are not equivalent to a trusted installed
plugin, real cross-project rollout, or owner acceptance. Clean local and
hosted check results must name the actual source revision.

## Modules and interfaces

- `hooks/hooks.json` declares supported native event routes. `tools/control-hook.ts` parses event input and delegates to the shared lifecycle evaluator.
- `tools/recovery-lifecycle.ts` handles lifecycle save/restore and recovery preconditions. `tools/control-event.ts` evaluates project enrollment, task state, repair and delivery guards, and native response shape. `tools/recovery-state.ts` retains explicit recovery gaps and reports.
- `tools/control-mcp.ts` registers the structured MCP interface. Its tools call the same task, history, repair, CI, decision, and delivery modules used by command entry points. MCP exposes evidence and status; it does not infer owner approval or semantic correctness.
- `tools/task-context.ts` validates project/task identity, discovers the Git worktree recovery location, reads or synchronizes GitHub snapshots, and writes/publishes local facts. Atomic local writes and pending-record retention protect facts until successful publication and readback.
- `tools/native-history.ts` uses the native `codex app-server --stdio` interface and validates paginated thread items; it does not read a private session database. `tools/recover-task.ts` reads supported native history pages and reports requests/failures not yet reconciled. Exhausting pages establishes history coverage, not interpretation.
- `tools/repair-evidence.ts` records actual check, diagnosis, and interpretation results and applies the repeated-failure guard.
- `tools/decision-evidence.ts` retains the exact referenced native user text and hash. This supports source tracing; it does not make the resulting interpretation an approval.
- `tools/ci-evidence.ts` captures candidate, worktree and environment around commands, and checks saved evidence against the full-spec entry. Evidence verification does not run the checks.
- `tools/delivery-evidence.ts` checks scope inventory, candidate-bound evidence and owner acceptance, and supports retraction. Its guard informs supported tool paths; it is not external authorization or merge protection.
- The project-contract module owns schema-1/2 enrollment types, runtime
  validation and explicit schema-1 migration; task identity imports this
  pure contract rather than the enrollment command implementation.
- The atomic-files module owns durable file writes; enrollment, native
  config, evidence, rollout and task state use this primitive directly.
  Their static internal module import graph no longer has cycles.
- `tools/project-enrollment.ts` enrolls or leaves a Git checkout. `.rill/project.json` identifies the repository and `.rill/authority.json` records trusted GitHub publisher IDs. Native plugin configuration is changed through `tools/native-config.ts`.

## State ownership and failure boundaries

GitHub issue and comments are the authority for approved scope and task history. Local snapshots are caches. Within Rill, local outbox records are the retained copy of unsynchronized facts until publication and readback; they must be retained. The Git revision and actual working tree establish code state. Native execution observations establish only the event, version, and path actually observed.

When GitHub is unavailable, a validated previously reconciled snapshot can support already authorized steps, while new facts remain pending. If a required fact is missing, dependent work pauses while independent checks continue. If task identity or recovery integrity is uncertain, supported dependent edits are guarded and the gap remains visible. Native history discovery and semantic reconciliation are separate operations.

Hooks are local deterministic checks and are bypassable. Declared configuration, actual native invocation, task-processing behavior, and semantic correctness are separate claims. MCP tool availability does not prove hooks ran. Plugin configuration changes may require native reload, and leaving an enrollment is not itself proof that the native host stopped invoking a previously loaded hook.

## Native role defaults

The checked-in project Codex configuration requests Sol at low effort for
coordination, Luna high for bounded worker/explorer/default roles, and a
two-child native concurrency cap. These are configuration defaults, not proof
that a new Codex session loaded them or delegated work automatically.
Independent review, native trust and current model observation remain
separate acceptance checks in #18.

## Delivery state

The source candidate and installed trusted plugin are separate versions. The #18 record identifies candidate 0.1.3 and installed trusted version 0.1.2; it also leaves final full-spec CI, independent review, owner acceptance, and the batch PR pending. Consult #18 and actual native evidence for current state; this architecture description is not runtime validation.

## Workspace boundaries and quality integration

The repository is a native pnpm Workspace with three concrete members:
the root Rill Codex plugin, packages/quality as the independently testable
quality-gates package, and the nested React web fixture used to test browser
build/type/test behavior. One root pnpm-lock.yaml governs all dependencies.
The native plugin manifest, hooks, MCP and command files stay at the root,
preserving the actual Codex discovery contract. No extra monorepo framework
or artificial packages are introduced.

Quality-gates tools use upstream formatters, linters, test frameworks,
security, license and complexity/source-inventory measurements. They do
not implement a second SemVer release registry, project binding system, or
MCP server. Versioned standards and rollout remain owned by the root
release/project/standard modules. Root and quality Biome configs have
non-overlapping source scopes. The root lock and scoped Mise tool list
avoid inheriting the host's unpinned global tools.

The root [Justfile](justfile) composes workspace-install and workspace-ci:
the plugin's existing full-spec checks plus the quality package's own
full-spec. The [GitHub Actions workflow](.github/workflows/quality.yml)
invokes these recipes. The native plugin staging recipe retains offline
dependency installation across filesystems through pnpm's verified local
Store with copy import; a stage is not an installed or trusted Codex plugin.
Pre-commit remains lint-only. Source coverage and complexity violations
in existing #18 plugin code are not considered resolved merely because
the independent quality-package fixture gates pass.

Task data, command logs and native source text can be sensitive. See [.github/SECURITY.md](.github/SECURITY.md) for the implemented trust and publication boundaries.
