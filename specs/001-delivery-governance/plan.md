---
id: DOC-007
title: Delivery governance plan
status: active
superseded_by:
last_updated: 2026-11-28
related_code:
  - .github/workflows/ci.yml
---

# Delivery governance implementation plan

1. Define the product change record and the maintenance exception in the PR template. Keep a short workflow entry in the repository guidance.
2. Validate the selected feature record in PR CI with Spec Kit's prerequisite check. Require a separate acceptance record with reproducible evidence. Run the existing verification gates for the candidate change.
3. Verify the local checks and record the live GitHub permissions. Activate independent enforcement only with a separate contributor identity and a trusted check producer. Verify rejection of missing evidence, modified gates, missing reviews, and stale approvals before declaring enforcement active.
