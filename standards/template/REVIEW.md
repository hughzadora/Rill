# Project Review Red Lines

1. Verify the candidate revision and a successful full local quality gate
   (`just ci-full`) before dispatching a reviewer.
2. Review only the relevant Git diff and narrow supporting source slices;
   prefer actual tests and runtime evidence over claims of correctness.
3. Never weaken, delete, skip or mock away existing assertions to achieve green
   CI. Keep unit, integration, type and security checks meaningful.
4. Examine race conditions, write ownership, path traversal, permissions,
   sensitive data, untrusted inputs and rollback/upgrade safety.
5. Changes to installed framework configuration require explicit controlled
   upgrades; preserve unrelated product-owned files and workflows.
6. Limit reviewers to one independent read-only agent at a time. Each finding
   needs exact `path:line` evidence and a reproducible failure case.
7. Check suspected findings for false positives. With no serious problems,
   report `LGTM` only.
8. Stop after a second unsuccessful review/fix round; return actionable
   evidence to the owner rather than cycling or escalating models automatically.
9. Reviewer feedback alone never grants permission to merge, deploy, release,
   purchase, or perform destructive operations.
