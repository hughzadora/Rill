# Rill Industrial Delivery Console

## User-facing goal

The console is a **software factory control room**, not an Issue index.
The owner should immediately see which product is being built, what
changed, blockers and dependencies, quality/proof of delivery, the
current agent's next safe step and the exact human inspection needed.

Rill as a cross-project standard is separate from whichever product the
owner is building. Do not hide that distinction by labeling every
project as a Rill development task.

## Product information architecture

1. **Portfolio / project intake:** select repository, greenfield/brownfield
   source, supported language profile, baseline failures and adoption status.
2. **Delivery overview:** outcome, current stage, workstream readiness,
   owners, blockers, dependencies and meaningful release trajectory.
3. **Execution board:** native parent/sub tasks with search, views by
   stage/status/priority/assignee and substantial details on selection.
4. **Task inspector:** acceptance checklists, issue body sections, risks,
   evidence links, linked PR/checks, updated time and next human action.
5. **Pipeline and QA:** stack coverage, real command status, test results,
   source coverage, regressions, accessibility, security and missing gates.
6. **Design and prototype:** runnable user flow, visual alternatives and
   their tradeoffs, not textual directions for the owner.
7. **Handoff and release:** what a new agent must read, current candidate,
   unresolved work, independent review, owner click acceptance and PR.

## Interaction model

Navigation and filter choices operate immediately; task selection reveals
actual acceptance and evidence without sending the owner into a wall of
Markdown. Search should cover titles, outcomes, status and checklist text.
Groups display aggregate counts _from authoritative records_. State
staleness and missing metadata must be unmistakable.

The dashboard uses GitHub's native parent/sub, issue fields/Projects when
available, and real PR/check facts. It never claims that OPEN means
"In Progress", or that CLOSED proves testing. Missing per-task gate
evidence is "Not verified", not passed.

The owner can inspect design tradeoffs in HTML, but a consequential
decision requires the genuine harness-native structured choice/approval
control. No DIY approval endpoint, copied commands, simulated vote or
fake AI callback.

## React and Tailwind delivery

The long-term console is a React + Tailwind application with a real
component hierarchy, typed data contracts, responsive master-detail
navigation, accessible semantics and error/empty/loading/stale states.
Use upstream Google Modern Web Guidance and Impeccable. Avoid generic
card piles where an operational list or data grid is more readable.
System Google Chrome is the first-class actual browser.

Test task navigation, filtering, API errors, keyboard navigation,
screen-reader status updates, mobile overflow and user-visible
readiness. Add axe-core and genuine component tests to the final
quality matrix. Screenshots assist owner verification but never replace
a meaningful click path.

## End-to-end owner journey

1. Open the factory console; select the actual project, not a default
   assumption of "Rill project".
2. See the project goal, active delivery stage and missing prerequisites.
3. Expand a workstream to see native tasks, dependencies, acceptance
   coverage, evidence and assigned next role.
4. Switch to quality and identify exactly which source stack and gates
   have run on the candidate.
5. Test the prototype / UI flow in Chrome; inspect design alternatives
   when a real consequential choice exists.
6. Complete the native harness decision, not an HTML decision surrogate.
7. Inspect independent review, actual behavior proof and final candidate.
8. Authorize PR/merge only through the actual supported platform control.

## Current versus desired state

The currently committed HTML reads one Rill issue tree live and supports
basic stages, filters and stale-state presentation. It is **not**
the comprehensive project management product described here, has no
cross-repository onboarding and is not implemented in React/Tailwind.
This is a known product gap, not a successfully delivered final UI.
