## Context

Both `browser-log.ts` and `browser-hrm.ts` compute the target date internally at automation time using Vietnam-timezone logic. The row/day they navigate to is always "today." The frontend never sends a date; the API routes never accept one. Adding user-selectable dates requires threading a date value from the UI through the API layer to both Playwright automations — a cross-cutting change across 6 files.

## Goals / Non-Goals

**Goals:**
- Let the user pick any calendar date within the current year before logging.
- Default the date picker to today (Vietnam timezone) on load and on ticket input change.
- Both "Log TSC" and "Log HRM" operations use the same selected date.
- Backward-compatible API: `date` field is optional; servers default to today if absent.

**Non-Goals:**
- Multi-year support (the Excel sheet is scoped to one year: "Daily Reports - 2026").
- Changing the HRM week navigation — the automation assumes the current week is visible; backfilling more than ~5 days may require a week navigation step (out of scope).
- A date range or batch logging across multiple days.

## Decisions

### 1. Date format: ISO string `YYYY-MM-DD` over a JS `Date` object or timestamp

Rationale: ISO strings survive JSON serialization without timezone ambiguity, are easy to validate with a regex in route handlers, and can be passed directly to `new Date(dateStr + "T00:00:00")` for local arithmetic. Passing a raw timestamp would require the server to interpret timezone intent; a full ISO datetime would add unnecessary precision.

Alternatives considered: Unix timestamp (harder to read in logs/tests), `Date` object (not JSON-serializable).

### 2. Single shared date state in `LogForm`, not per-button

Both "Log TSC" and "Log HRM" share one `selectedDate` state. This avoids the UX confusion of two separate date pickers that could diverge.

Alternatives considered: Per-button date (rejected — complicates UI; uncommon need).

### 3. `date` is optional in API request bodies; backend defaults to today

This keeps the API backward-compatible and simplifies tests that don't care about date.

Alternatives considered: Required field (would break existing curl tests and automation scripts).

### 4. Browser automations receive a `Date` object, not a raw string

Route handlers parse the ISO string and pass a `Date` to `writeTicketViaPlaywright` / `logTicketsToHrm`. This keeps date arithmetic in one place (the browser lib) and avoids re-parsing in multiple spots.

Alternatives considered: Pass ISO string all the way down (would scatter `new Date()` construction).

## Risks / Trade-offs

- **HRM week navigation**: `browser-hrm.ts` locates today's row by matching a date string on the visible page. If the user picks a date from a different week, that row may not be visible. The current automation does not navigate weeks. For now, selecting a past date in a different week will fail gracefully (the "add task" button won't be found) and return an error message. Full week navigation is a follow-up.

- **Excel row mismatch**: `browser-log.ts` computes `row = 2 + dayOfYear`. If the user selects a date outside the current year, the row will be wrong. The UI will constrain the picker to the current year (Vietnam time) to prevent this.

- **Vietnam timezone on the client**: The date input defaults to today in Vietnam time. On a machine in a different timezone, `new Date()` on the client would give the wrong default. We derive the default date string server-side (or use `Intl` on the client) to ensure correctness.

## Migration Plan

No data migration required. The change is purely additive — a new optional field in request bodies and new optional parameters in existing functions. Existing behaviour is preserved when `date` is omitted.

Rollback: revert the 6 changed files; no DB schema or persistent state is involved.

## Open Questions

- None blocking implementation.
