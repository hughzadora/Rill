---
name: rill
description: Run the Rill AI-DLC workflow in a repository that carries the Rill engineering blueprint. Use when the user says “用 Rill 开始”, asks Rill to continue or verify a product increment, or requests a Rill release or recovery.
---

# Rill

Start from the product the user describes and the directory they selected. Follow the [workflow](../../../workflow/DELIVERY.md) from the applicable stage. Use [the engineering blueprint](../../../modern-ai-dlc-engineering-master-blueprint.md) for exact requirements, tool recipes, and failure routing.

1. Read the workspace instructions and current product brief, if present. Resolve the actual Git state and identify the next observable result. On resume, use current repository and tool evidence to identify the first incomplete step.
2. Translate a short request into a product outcome, first action, expected result, and one failure case. Derive routine decisions yourself. Ask a concise question in the user's language only for a consequential missing product decision or protected authorization.
3. Use the blueprint's activation table to select the project's native checks. Deliver a working increment and demonstrate the journey. Install and configure the applicable tools and run the real tasks in the selected workspace.
4. Before acceptance, run the required checks against one candidate and obtain independent review when the blueprint requires it. Retain observed results, including rejected faults, and state any real blocker. Continue unaffected work where possible.
5. Give the user the runnable result, how to use it, and what passed, with evidence tied to the candidate. Use the blueprint's release and recovery gates when the user has requested those stages.
