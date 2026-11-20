---

name: rill-review
description: Independently review Rill product changes with exact-SHA code, behavior, security and regression evidence.
---

Start from a fresh Codex reviewer context, never the implementing thread.

1. Read product requirements and issue acceptance, actual base/head refs and
   changed sources. Find the exact locks and native quality commands.
2. Review correctness, security, compatibility with existing native tools,
   source/test inventory, browser/CLI behavior and negative test effectiveness.
3. Reproduce every material finding against the current SHA; include file,
   symptom, root cause and smallest durable fix. Don't assign numeric opinion
   ratings or accept a green fixture as external-project success.
4. Do not modify the implementation or declare owner approval. Return a
   concise actionable review to the coordinator and GitHub PR.
