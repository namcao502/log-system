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
[   Log All (TSC + HRM)    ]        ← full width, purple (bg-purple-600 hover:bg-purple-700)
```

## Enable Conditions

All conditions use the `AsyncStatus` discriminated union (`.state` field), not string equality on the object itself.

| Button | Enabled when |
|--------|-------------|
| Log TSC | `jiraStatus.state === "success" && !isLogging` |
| Add to HRM | `canAddToHrm && !isLogging` (unchanged) |
| Log HRM (N) | `hrmTickets.length > 0 && !isLogging` (unchanged) |
| Log All | `jiraStatus.state === "success" && hrmTickets.length > 0 && !isLogging` |

`isLogging` remains `logStatus.state === "loading" || hrmStatus.state === "loading"`.

The `handleLogAll` function guard mirrors the button's disabled condition exactly:

```ts
if (jiraStatus.state !== "success" || hrmTickets.length === 0 || isLogging) return;
```

This protects against double-invocation (e.g. rapid double-tap) even if the disabled attribute is somehow bypassed.

## Behavior

When "Log All" is clicked:

1. Both `logStatus` and `hrmStatus` are set to `loading` **synchronously before any fetch**, ensuring the UI reflects the in-progress state immediately.
2. The TSC fetch (`POST /api/sharepoint/log`) and HRM fetch (`POST /api/hrm/log`) are fired in parallel via `Promise.all`.
3. Each fetch updates its own status indicator independently — a failure in one does not affect the other.
4. The existing "TSC Log" and "HRM Log" `StatusIndicator` rows display the results.

**Independent targets:** "Log All" logs the currently verified `ticket` to TSC, and logs whatever is in `hrmTickets` to HRM. The TSC ticket does not need to be present in `hrmTickets` — the two lists are intentionally independent. A user can verify ticket A, add tickets B and C to HRM, then click "Log All": TSC logs A, HRM logs B and C. This is the intended design.

**Closure capture:** `hrmTickets` is in the `useCallback` dep array, so the callback always reflects the value at the time it was last created. The payload sent to the server is the `hrmTickets` array at the moment the user clicked — this is correct. The success message also reflects that same snapshot, which is the right behavior.

## Code Changes — `components/LogForm.tsx`

### 1. Update existing handlers

**Remove cross-resets:**
- `handleLogTsc`: remove `setHrmStatus({ state: "idle" })`
- `handleLogHrm`: remove `setLogStatus({ state: "idle" })`

**Add `isLogging` guard to both existing handlers** (for consistency with `handleLogAll` and protection against programmatic double-invocation):
- `handleLogTsc`: add `|| isLogging` to its early return guard; add `logStatus.state, hrmStatus.state` to its `useCallback` dep array
- `handleLogHrm`: add `|| isLogging` to its early return guard; add `logStatus.state, hrmStatus.state` to its `useCallback` dep array

**Why removing cross-resets is safe:** Both `handleTicketChange` and `handleVerify` already reset `logStatus` and `hrmStatus` to idle, so on any normal ticket workflow both statuses start idle. The UX consequence of removing the cross-resets: if a user logs HRM (it errors) then clicks "Log TSC", the HRM error stays visible alongside the TSC result. This is intentional — it gives full visibility into both outcomes.

### 2. Add `handleLogAll`

```ts
const handleLogAll = useCallback(async () => {
  if (jiraStatus.state !== "success" || hrmTickets.length === 0 || isLogging) return;

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
}, [ticket, selectedDate, jiraStatus.state, hrmTickets, logStatus.state, hrmStatus.state]);
// Dep array note: isLogging is a derived local variable, not a stable dep.
// Include logStatus.state and hrmStatus.state directly so exhaustive-deps is satisfied.
```

### 3. JSX layout change

Replace the single `<div className="flex gap-3">` action row with:

```jsx
<div className="flex flex-col gap-3">
  <button className="w-full ..." /* Log TSC — bg-blue-600, replace flex-1 with w-full */ />
  <div className="flex gap-3">
    <button /* Add to HRM — bg-green-600, unchanged */ />
    <button /* Log HRM (N) — bg-blue-600, unchanged */ />
  </div>
  <button className="w-full ..." /* Log All — bg-purple-600 hover:bg-purple-700 */ />
</div>
```

Note: the existing "Log TSC" button uses `flex-1` inside a flex row. In the new `flex-col` container `flex-1` has no effect — replace it with `w-full`.

## Tests — `__tests__/LogForm.test.tsx`

- "Log All" button is disabled when Jira is not verified
- "Log All" button is disabled when HRM ticket list is empty
- "Log All" button is disabled while TSC log is in-flight (`logStatus.state === "loading"`)
- "Log All" button is disabled while HRM log is in-flight (`hrmStatus.state === "loading"`)
- Clicking "Log All" sets both `logStatus` and `hrmStatus` to `loading` synchronously before any fetch resolves
- "Log All" fires both `/api/sharepoint/log` and `/api/hrm/log` when clicked
- Both TSC and HRM statuses show success when both operations succeed (happy path)
- TSC status shows success independently when HRM fails
- HRM status shows success independently when TSC fails
- Entering a new ticket (or clicking Verify) after "Log All" completes resets both `logStatus` and `hrmStatus` to idle

## Out of Scope

- No new API routes
- No new components
- No changes to `StatusIndicator`
