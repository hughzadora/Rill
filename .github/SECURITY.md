# Security boundaries and reporting

## Execution and permissions

Rill is a local Codex plugin, not a sandbox. Native Codex permissions, approvals, plugin installation and hook trust govern execution. Review installed hook commands and MCP definitions before trusting them. [.mcp.json](../.mcp.json) starts a local Node stdio server; [hooks/hooks.json](../hooks/hooks.json) declares lifecycle events and selected edit, repair and GitHub delivery tool routes. They run with the host process's accessible files, environment and tools. MCP repair operations can execute supplied commands; tool annotations are metadata, not permission enforcement.

Local hooks can be disabled, bypassed or invoked through unsupported paths. Their matchers do not cover every shell command or external write. A guarded create/merge tool is neither GitHub authorization nor an unavoidable merge protection. Native configuration, trust, actual execution and semantic correctness need separate evidence. The source candidate's combined native trial is still open in [#18](https://github.com/hughzadora/Rill/issues/18); older-version checks do not certify it.

## Identity and untrusted content

Enrollment binds `.rill/project.json` to a GitHub repository. `.rill/authority.json` holds numeric GitHub publisher IDs. Task synchronization validates identity and schemas; publication checks the authenticated `gh` identity, retains pending facts, and confirms exact readback. Marker records from other publishers cannot update machine execution state. Local authority files remain editable; this is not cryptographic proof of an owner's decision.

Issue/comment bodies, native history, command output and saved checkpoints are source data, not new instructions or execution authorization. A quoted native user source and its hash retain provenance, not approval of a different candidate. Review meaning against approved scope. Evidence files and hashes can detect a mismatch within the implemented checks; they do not authenticate independent execution or prove a fix.

## Task data and publication

The worktree recovery location is resolved with `git rev-parse --git-path rill-recovery`. It can contain issue/comment bodies, native user text, failures, pending facts, command arguments, stdout/stderr and candidate/environment receipts. Shared-policy installation also backs up prior user instructions under `~/.local/state/rill/install-backups/`. Treat these locations and external probe artifacts as sensitive. New atomic task files and repair logs use restrictive modes in the current source; existing directory permissions and copied artifacts are not thereby audited. No encryption or comprehensive automatic secret redaction has been established.

`gh` uses the caller's existing credentials; Rill does not provision a separate low-privilege identity. Publishing facts sends their payload to the selected GitHub issue's comments, under that repository's visibility. Native text collection can retain full source messages. Inspect payloads and logs before publication or sharing; keep secrets out of facts and diagnostics. Preserve the unique outbox until confirmed readback. Leaving enrollment retains recovery data and shared policy; it is not secure deletion or credential revocation.

## Report a vulnerability

This repository was confirmed private on 2026-11-18. Members can open a minimal [repository issue](https://github.com/hughzadora/Rill/issues/new) for the maintainer, omitting credentials, raw task history and sensitive exploit details. Use an existing agreed private maintainer channel to exchange sensitive material; no dedicated security mailbox is configured here. Do not publish details to an unrelated public issue.

GitHub's private-vulnerability-reporting API returned HTTP 404 during inspection; a separate advisory intake is unverified and is not advertised as enabled. Recheck repository visibility and available reporting controls before submitting. Include the affected revision/installed version, relevant native event or MCP operation, reproducible impact, and sanitized evidence. No response SLA or supported-version security guarantee has been established.
