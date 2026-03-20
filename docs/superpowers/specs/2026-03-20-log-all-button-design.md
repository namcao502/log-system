# Log All Button — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Overview

Add a **"Log All (TSC + HRM)"** button to `LogForm` that fires both the TSC Excel log and the HRM timesheet log in parallel with a single click. The existing "Log TSC" and "Log HRM (N)" buttons remain unchanged for users who want to log to only one system.

## Button Layout

The action buttons section changes from a single horizontal row to a vertical column:

```
[          Log TSC          ]        ← full width
[  Add to HRM  ][  Log HRM (N)  ]   ← side by side (unchanged)
[   Log All (TSC + HRM)    ]        ← full width, distinct color
```

## Enable Conditions

| Button | Enabled when |
|--------|-------------|
| Log TSC | `jiraStatus === "success" && !isLogging` |
| Add to HRM | `canAddToHrm && !isLogging` (unchanged) |
| Log HRM (N) | `hrmTickets.length > 0 && !isLogging` (unchanged) |
| Log All | `jiraStatus === "success" && hrmTickets.length > 0 && !isLogging` |

`isLogging` remains `logStatus.state === "loading" || hrmStatus.state === "loading"`.

## Behavior

When "Log All" is clicked:

1. Both `logStatus` and `hrmStatus` are set to `loading` immediately.
2. The TSC fetch (`POST /api/sharepoint/log`) and HRM fetch (`POST /api/hrm/log`) are fired in parallel via `Promise.all`.
3. Each fetch updates its own status indicator independently — a failure in one does not affect the other.
4. The existing "TSC Log" and "HRM Log" `StatusIndicator` rows display the results.

## Code Changes — `components/LogForm.tsx`

### 1. Remove cross-resets from existing handlers

- `handleLogTsc`: remove `setHrmStatus({ state: "idle" })`
- `handleLogHrm`: remove `setLogStatus({ state: "idle" })`

These lines were defensive guards that are no longer appropriate when both operations can run together. Removing them has no effect on the single-operation flows since both statuses start idle on page load and on ticket change.

### 2. Add `handleLogAll`

```ts
const handleLogAll = useCallback(async () => {
  if (jiraStatus.state !== "success" || hrmTickets.length === 0) return;

  setLogStatus({ state: "loading" });
  setHrmStatus({ state: "loading" });

  await Promise.all([
    // TSC: same fetch logic as handleLogTsc, updates logStatus
    (async () => {
      try {
        const res = await fetch("/api/sharepoint/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket, date: selectedDate }),
        });
        const data = (await res.json()) as LogResponse;
        if (data.success) {
          setLogStatus({ state: "success", message: `Logged "${ticket}" at cell ${data.cell ?? "O"}` });
        } else {
          setLogStatus({ state: "error", message: data.error ?? "Failed to log" });
        }
      } catch {
        setLogStatus({ state: "error", message: "Failed to write to Excel" });
      }
    })(),
    // HRM: same fetch logic as handleLogHrm, updates hrmStatus
    (async () => {
      try {
        const res = await fetch("/api/hrm/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickets: hrmTickets.map((t) => t.ticket), date: selectedDate }),
        });
        const data = (await res.json()) as HrmLogResponse;
        if (data.success) {
          const ticketIds = hrmTickets.map((t) => t.ticket).join(", ");
          setHrmStatus({ state: "success", message: `Logged ${ticketIds} to HRM timesheet` });
        } else {
          setHrmStatus({ state: "error", message: data.error ?? "Failed to log to HRM" });
        }
      } catch {
        setHrmStatus({ state: "error", message: "Failed to reach HRM" });
      }
    })(),
  ]);
}, [ticket, selectedDate, jiraStatus.state, hrmTickets]);
```

### 3. JSX layout change

Replace the single `<div className="flex gap-3">` action row with:

```jsx
<div className="flex flex-col gap-3">
  <button /* Log TSC — full width */ />
  <div className="flex gap-3">
    <button /* Add to HRM */ />
    <button /* Log HRM (N) */ />
  </div>
  <button /* Log All — full width, distinct color */ />
</div>
```

## Tests — `__tests__/LogForm.test.tsx`

- "Log All" button is disabled when Jira is not verified
- "Log All" button is disabled when HRM ticket list is empty
- "Log All" fires both `/api/sharepoint/log` and `/api/hrm/log` when clicked
- TSC status shows success independently when HRM fails
- HRM status shows success independently when TSC fails

## Out of Scope

- No new API routes
- No new components
- No changes to `StatusIndicator`
