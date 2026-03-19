---
name: implement
description: Run the full development workflow for a feature or task. Use when the user runs /implement with any feature description, requirement, or task — even vague ones like "add dark mode" or "make X better". Triggers the full plan → implement → review → test → document pipeline for C:/TEST/log-system.
---

# Implement Feature

When the user runs `/implement`, execute the full development workflow for the feature or requirements they provide.

## Usage

```
/implement
Add a log viewer dashboard
```

Or with more detail:

```
/implement
Feature: Log filtering
Add real-time log filtering by level (info, warn, error).
Support text search across log messages.
Persist filter preferences in localStorage.
```

No Jira ticket required. No branch required. All work goes directly on the current branch (usually `master`).

---

## Repo Path

| Repo | Path |
|------|------|
| Project | `C:/TEST/log-system` |

---

## Workflow

> **Gate:** Stop and wait for the user only after Step 2 (Implementation Plan). All other steps auto-proceed immediately.

---

### Step 1: Parse Requirements

Read the feature description provided by the user in `$ARGUMENTS`. Derive:
- A short **feature ID** (e.g. `FEAT-log-viewer`) — kebab-case, prefixed with `FEAT-`
- A concise **title** (one line)
- **Scope** — `FE-only`, `BE-only`, or `Full-stack`
- **Requirements** — what needs to be built, broken into bullet points
- **Acceptance criteria** — what "done" looks like
- **Constraints** — strict TypeScript, no `any`, follow existing project conventions

Display a summary table:

| Field | Value |
|-------|-------|
| Feature ID | `FEAT-<name>` |
| Title | `<1-line title>` |
| Scope | `<scope>` |
| Requirements | `<bulleted list>` |
| Acceptance Criteria | `<bulleted list>` |
| Constraints | Strict TS · No `any` · Project conventions |

Then immediately proceed to Step 2 without waiting.

---

### Step 2: Implementation Plan

Only run this step when the user says to proceed.

Spawn a `plan-creator` agent:

**Prompt:**
```
Feature: <feature-id>
Title: <title>
Scope: <scope>
Repo: C:/TEST/log-system

Requirements:
<requirements bullet list>

Acceptance Criteria:
<acceptance criteria bullet list>
```

Display the plan-creator's output, then output:

```
---
Step 2 complete. Review the implementation plan above.
Reply "next" to start implementation, or describe changes to the plan first.
---
```

- If user requests changes → re-spawn `plan-creator` with the original prompt plus:
  ```
  User correction: <feedback>
  Revise the plan accordingly and output the full updated plan.
  ```
  Show the revised plan and display the gate again. Repeat until the user says "next".

Store the approved plan as `<implementation plan>`.

**Wait for the user.** ← This is the only gate in the workflow.

---

### Step 3: Implementation

Only run this step when the user says to proceed.

Spawn a `fe-engineer` agent (for FE work) and/or `be-engineer` agent (for logic/data work):

**Prompt:**
```
Feature: <feature-id>
Title: <title>
Repo: C:/TEST/log-system
Branch: master (work directly on master — do NOT create or switch branches)

Requirements:
<requirements bullet list>

Implementation Plan:
<implementation plan>
```

Store the engineer's output as `<engineer summary>`, then immediately proceed to Step 4.

---

### Step 4: Code Review

Only run this step when the user says to proceed.

Spawn a `code-review-engineer` agent:

**Prompt:**
```
Feature: <feature-id>
Repo: C:/TEST/log-system

Requirements:
<requirements bullet list>

Acceptance Criteria:
<acceptance criteria bullet list>

Engineer Summary:
<engineer summary>
```

If the review returns **FAIL**:
- List the issues clearly
- Spawn the appropriate engineer agent with the review feedback to fix each issue
- Re-run `code-review-engineer` after fixes
- Repeat up to 3 rounds
- If still FAIL after 3 rounds: stop and tell the user to review the remaining issues manually

Once review **PASS**, immediately proceed to Step 5.

---

### Step 5: Tests

Only run this step when the user says to proceed.

Spawn a `qa-engineer` agent:

**Prompt:**
```
Feature: <feature-id>
Repo: C:/TEST/log-system

Requirements:
<requirements bullet list>

Engineer Summary:
<engineer summary>
```

Display the QA output, then immediately proceed to Step 6.

---

### Step 6: Documentation

Only run this step when the user says to proceed.

Spawn a `doc-engineer` agent:

**Prompt:**
```
Feature: <feature-id>
Title: <title>
Repo: C:/TEST/log-system

Requirements:
<requirements bullet list>

Engineer Summary:
<engineer summary>
```

Display the doc output, then immediately proceed to Step 7.

---

### Step 7: Self-Review

Only run this step when the user says to proceed.

Run directly (no sub-agent):

```bash
# Recent commits
cd C:/TEST/log-system && git log --oneline -5

# Files changed in the last commit(s)
cd C:/TEST/log-system && git diff HEAD~1 --name-only

# Lint
cd C:/TEST/log-system && npm run lint

# Tests
cd C:/TEST/log-system && npm test
```

Output a self-review report:

```
## Self-Review: <feature-id>

### Checks
- Lint: PASS / FAIL
- Tests: PASS / FAIL (N passed, N failed)

### Files Changed
- <list from git diff>

### Acceptance Criteria
- [x] <criterion> — implemented in <file>
- [ ] <criterion> — NOT implemented (<reason>)

### Verdict
READY / NEEDS ATTENTION — <one-line summary>
```

If **NEEDS ATTENTION**: list what needs fixing. Do not proceed until resolved.

---

## Final Summary

Output when all steps are complete:

| Step | Status | Details |
|------|--------|---------|
| Requirements | Done | `<title>` |
| Implementation Plan | Approved | `<N files>` |
| Implementation | Done | `<N files changed>` |
| Code Review | Passed | |
| Tests | Done | `<N tests added>` |
| Docs | Done | |
| Self-Review | READY | `<verdict summary>` |
