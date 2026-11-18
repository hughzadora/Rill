# Rill

Personal preferences: [project policy](docs/policy.md). Approved scope and current delivery: [#18](https://github.com/hughzadora/Rill/issues/18).

From a target Git checkout, run `node /path/to/Rill/tools/project-enrollment.ts enroll owner/repository`, then bind its task with the task-sync tool. Enrollment resolves the current GitHub publisher, preserves existing tools and edits only Rill's native plugin enable key and enrollment files. Existing publisher or repository conflicts require reconciliation. Install/review the plugin through Codex's native controls; enrollment does not grant trust.

Run `node /path/to/Rill/tools/project-enrollment.ts leave` to disable the project entry after pending facts are published and read back. Recovery data and publisher configuration remain available; native plugin configuration takes effect on reload. Codex can resolve linked-worktree project configuration from the primary checkout: the enrollment marker independently makes unenrolled hook calls return without task processing. Native hook invocation, task processing and merge protection are separate guarantees.

`node tools/install-personal-policy.ts` installs the short shared entry into the native user `AGENTS.md`, preserving its symlink and all content outside the managed Rill block. Originals are backed up under `~/.local/state/rill/install-backups/`; it leaves native hook trust unchanged.
