---
id: SPEC-005
title: Triage Label Mapping
status: active
superseded_by:
last_updated: 2026-11-27
related_code: []
---

# Triage Label Mapping

Default mapping from engineering skill roles to GitHub labels.

| Skill role        | GitHub label      | Meaning                                          |
| ----------------- | ----------------- | ------------------------------------------------ |
| `needs-triage`    | `needs-triage`    | Maintainer needs to evaluate the issue           |
| `needs-info`      | `needs-info`      | Waiting for more information from the reporter   |
| `ready-for-agent` | `ready-for-agent` | An agent can implement the fully specified issue |
| `ready-for-human` | `ready-for-human` | Implementation requires a human                  |
| `wontfix`         | `wontfix`         | The issue will be closed without implementation  |

Apply the corresponding GitHub label when an engineering skill names a triage role.
