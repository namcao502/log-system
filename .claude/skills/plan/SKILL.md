---
name: plan
description: Explore the codebase and produce a detailed file-by-file implementation plan for a feature. Use when the user runs /plan with a feature description. Does NOT write any code.
---

# Plan Feature

Produce a precise, actionable implementation plan for the feature described in `$ARGUMENTS`. Do NOT write any code or modify any files.

## Project

Next.js 15 App Router + TypeScript + Tailwind CSS at `C:/TEST/log-system`.

## Instructions

1. Read `CLAUDE.md` for architecture and conventions.
2. Read every file that is likely to be affected before planning.
3. Identify every file that must be **created** or **modified**, with a precise description of the change.
4. Flag any type changes that cascade to other files.
5. Note any new Tailwind classes that require additions to `tailwind.config.ts`.
6. Call out edge cases or constraints the engineer must handle.

## Output Format

```
## Plan: <feature title>

### Changes
| File | Action | Description |
|------|--------|-------------|
| `lib/types.ts` | Modify | Add X field to Y interface |
| `components/Foo.tsx` | Create | New component for X |

### Notes
- Any cascading effects, edge cases, or constraints

### Out of Scope
- Anything explicitly NOT needed for this feature
```

Keep it tight — one row per file, one clear description per row.
