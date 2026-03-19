# HRM Log Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone "Log HRM" button beside the existing "Log TSC" button so the user can log to each system independently after Jira verification.

**Architecture:** Replace the combined "Log" button (which fires both TSC + HRM) with two side-by-side buttons — "Log TSC" and "Log HRM" — each calling only its respective API. The "Test TSC" button is removed; `handleTestTsc` becomes `handleLogTsc` (now requires Jira success). A new `handleLogHrm` calls `POST /api/hrm/log` independently. Each handler resets the other's status to `idle` at start to prevent stale state. Tests are updated/added to cover both buttons.

**Tech Stack:** Next.js 15, React, TypeScript, Jest + React Testing Library

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `components/LogForm.tsx` | Modify | Replace `handleTestTsc` / `handleLogAll` with `handleLogTsc` / `handleLogHrm`; fix `handleVerify` reset; update buttons |
| `__tests__/LogForm.test.tsx` | Modify | Update "Log to TSC" → "Log TSC" tests + add "Log HRM" tests |

**Pre-existing (no changes needed):**
- `lib/types.ts` — `HrmLogResponse`, `HrmLogRequestBody` already defined
- `app/api/hrm/log/route.ts` — already implemented
- `app/api/sharepoint/log/route.ts` — already implemented

---

### Task 1: Update LogForm — split buttons and handlers

**Files:**
- Modify: `components/LogForm.tsx`

**Context:**
Current buttons:
- "Test TSC" — calls `handleTestTsc`, only needs `isTicketValid`
- "Log" — calls `handleLogAll` (TSC + HRM in parallel), needs `jiraStatus === "success"`

Target buttons (side by side, both require Jira):
- "Log TSC" — calls `handleLogTsc` (TSC only)
- "Log HRM" — calls `handleLogHrm` (HRM only)

- [ ] **Step 1: Replace `handleTestTsc` with `handleLogTsc`**

Remove `handleTestTsc`. Add `handleLogTsc` — it requires Jira success, resets `hrmStatus` to idle at start:

```tsx
const handleLogTsc = useCallback(async () => {
  if (jiraStatus.state !== "success") return;

  setLogStatus({ state: "loading" });
  setHrmStatus({ state: "idle" });
  try {
    const res = await fetch("/api/sharepoint/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket }),
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
}, [ticket, jiraStatus.state]);
```

- [ ] **Step 2: Replace `handleLogAll` with `handleLogHrm`**

Remove `handleLogAll`. Add `handleLogHrm` — resets `logStatus` to idle at start:

```tsx
const handleLogHrm = useCallback(async () => {
  if (jiraStatus.state !== "success") return;

  setHrmStatus({ state: "loading" });
  setLogStatus({ state: "idle" });
  try {
    const res = await fetch("/api/hrm/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickets: [ticket] }),
    });
    const data = (await res.json()) as HrmLogResponse;
    if (data.success) {
      setHrmStatus({ state: "success", message: `Logged "${ticket}" to HRM timesheet` });
    } else {
      setHrmStatus({ state: "error", message: data.error ?? "Failed to log to HRM" });
    }
  } catch {
    setHrmStatus({ state: "error", message: "Failed to reach HRM" });
  }
}, [ticket, jiraStatus.state]);
```

- [ ] **Step 3: Fix `handleVerify` to also reset `hrmStatus`**

In the existing `handleVerify` handler, add `setHrmStatus({ state: "idle" })` alongside the existing `setLogStatus({ state: "idle" })`:

```tsx
const handleVerify = useCallback(async () => {
  if (!isTicketValid) return;

  setJiraStatus({ state: "loading" });
  setLogStatus({ state: "idle" });
  setHrmStatus({ state: "idle" });  // ← add this line
  // ... rest unchanged
```

- [ ] **Step 4: Remove `isLogging` dependency on parallel state, update buttons JSX**

`isLogging` stays the same (checks both loading states):

```tsx
const isLogging = logStatus.state === "loading" || hrmStatus.state === "loading";
```

Replace the action buttons section:

```tsx
{/* Action buttons */}
<div className="flex gap-3">
  <button
    type="button"
    disabled={jiraStatus.state !== "success" || isLogging}
    onClick={handleLogTsc}
    className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white
               hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
  >
    Log TSC
  </button>
  <button
    type="button"
    disabled={jiraStatus.state !== "success" || isLogging}
    onClick={handleLogHrm}
    className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white
               hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
  >
    Log HRM
  </button>
</div>
```

- [ ] **Step 5: Run tests to see current failures**

```bash
cd C:/TEST/log-system && npx jest __tests__/LogForm.test.tsx --no-coverage 2>&1 | tail -30
```

Expected: failures referencing "Log to TSC" and "Test TSC" mismatches — that's fine, tests get fixed next.

- [ ] **Step 6: Commit**

```bash
git add components/LogForm.tsx
git commit -m "feat: split Log button into Log TSC and Log HRM individual buttons"
```

---

### Task 2: Update tests for new button structure

**Files:**
- Modify: `__tests__/LogForm.test.tsx`

- [ ] **Step 1: Update all "Log to TSC" → "Log TSC" button references**

Replace every occurrence of `/log to tsc/i` with `/log tsc/i` in the test file. Also update describe block names:

```diff
-describe("LogForm -- Log to TSC button disabled states", () => {
+describe("LogForm -- Log TSC button disabled states", () => {
   it("is disabled before verification", () => {
     render(<LogForm />);
-    expect(screen.getByRole("button", { name: /log to tsc/i })).toBeDisabled();
+    expect(screen.getByRole("button", { name: /log tsc/i })).toBeDisabled();
   });

   it("is enabled after successful verification", async () => {
     ...
-    expect(screen.getByRole("button", { name: /log to tsc/i })).toBeEnabled();
+    expect(screen.getByRole("button", { name: /log tsc/i })).toBeEnabled();
   });
 });
```

In all Log happy path, error path, and loading tests:
```diff
-  await user.click(screen.getByRole("button", { name: /log to tsc/i }));
+  await user.click(screen.getByRole("button", { name: /log tsc/i }));
```

Also update the loading state test message from "Writing to Excel..." to match:
```diff
-  expect(screen.getByText("Writing to Excel... (browser will open briefly)")).toBeInTheDocument();
+  expect(screen.getByText("Writing to Excel... (browser will open briefly)")).toBeInTheDocument();
```
(This message stays the same — confirm it's in the StatusIndicator for TSC Log.)

- [ ] **Step 2: Add "Log HRM" disabled state tests**

Add after the "Log TSC" disabled state describe block:

```tsx
describe("LogForm -- Log HRM button disabled states", () => {
  it("is disabled before verification", () => {
    render(<LogForm />);
    expect(screen.getByRole("button", { name: /log hrm/i })).toBeDisabled();
  });

  it("is enabled after successful verification", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await verifySuccessFlow(user);
    expect(screen.getByRole("button", { name: /log hrm/i })).toBeEnabled();
  });
});
```

- [ ] **Step 3: Add "Log HRM" happy path tests**

```tsx
describe("LogForm -- Log HRM happy path", () => {
  it("shows success message on successful HRM log", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await verifySuccessFlow(user);

    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));

    await user.click(screen.getByRole("button", { name: /log hrm/i }));

    await waitFor(() =>
      expect(screen.getByText(/Logged "MDP-1234" to HRM timesheet/)).toBeInTheDocument()
    );
  });

  it("sends POST to /api/hrm/log with tickets array in body", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await verifySuccessFlow(user);

    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));

    await user.click(screen.getByRole("button", { name: /log hrm/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/hrm/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickets: ["MDP-1234"] }),
      });
    });
  });
});
```

- [ ] **Step 4: Add "Log HRM" error path tests**

```tsx
describe("LogForm -- Log HRM error paths", () => {
  it("shows error when HRM API returns failure", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await verifySuccessFlow(user);

    mockFetch.mockReturnValueOnce(
      jsonResponse({ success: false, error: "HRM automation failed" })
    );

    await user.click(screen.getByRole("button", { name: /log hrm/i }));

    await waitFor(() =>
      expect(screen.getByText("HRM automation failed")).toBeInTheDocument()
    );
  });

  it("shows fallback error when success is false and no error message", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await verifySuccessFlow(user);

    mockFetch.mockReturnValueOnce(jsonResponse({ success: false }));

    await user.click(screen.getByRole("button", { name: /log hrm/i }));

    await waitFor(() =>
      expect(screen.getByText("Failed to log to HRM")).toBeInTheDocument()
    );
  });

  it("shows network error when HRM fetch throws", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await verifySuccessFlow(user);

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await user.click(screen.getByRole("button", { name: /log hrm/i }));

    await waitFor(() =>
      expect(screen.getByText("Failed to reach HRM")).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 5: Add loading state tests for HRM button**

In the existing loading states describe block, add:

```tsx
it("disables Log HRM button while HRM logging is in progress", async () => {
  const user = userEvent.setup();
  render(<LogForm />);

  await verifySuccessFlow(user);

  mockFetch.mockReturnValueOnce(new Promise(() => {}));

  await user.click(screen.getByRole("button", { name: /log hrm/i }));

  expect(screen.getByRole("button", { name: /log hrm/i })).toBeDisabled();
});

it("shows Logging to HRM... message during HRM loading", async () => {
  const user = userEvent.setup();
  render(<LogForm />);

  await verifySuccessFlow(user);

  mockFetch.mockReturnValueOnce(new Promise(() => {}));

  await user.click(screen.getByRole("button", { name: /log hrm/i }));

  expect(screen.getByText("Logging to HRM... (browser will open briefly)")).toBeInTheDocument();
});
```

- [ ] **Step 6: Add cross-button state isolation test**

Add a test verifying that clicking "Log TSC" clears any previous HRM status and vice versa:

```tsx
describe("LogForm -- cross-button state isolation", () => {
  it("resets HRM status when Log TSC is clicked", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await verifySuccessFlow(user);

    // First log to HRM → get an error
    mockFetch.mockReturnValueOnce(
      jsonResponse({ success: false, error: "HRM error" })
    );
    await user.click(screen.getByRole("button", { name: /log hrm/i }));
    await waitFor(() => expect(screen.getByText("HRM error")).toBeInTheDocument());

    // Now click Log TSC → HRM status should reset to idle (message gone)
    mockFetch.mockReturnValueOnce(new Promise(() => {})); // keep TSC loading
    await user.click(screen.getByRole("button", { name: /log tsc/i }));

    expect(screen.queryByText("HRM error")).not.toBeInTheDocument();
  });

  it("resets TSC status when Log HRM is clicked", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await verifySuccessFlow(user);

    // First log to TSC → get an error
    mockFetch.mockReturnValueOnce(
      jsonResponse({ success: false, error: "TSC error" })
    );
    await user.click(screen.getByRole("button", { name: /log tsc/i }));
    await waitFor(() => expect(screen.getByText("TSC error")).toBeInTheDocument());

    // Now click Log HRM → TSC status should reset to idle (message gone)
    mockFetch.mockReturnValueOnce(new Promise(() => {})); // keep HRM loading
    await user.click(screen.getByRole("button", { name: /log hrm/i }));

    expect(screen.queryByText("TSC error")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run all tests and verify they pass**

```bash
cd C:/TEST/log-system && npx jest __tests__/LogForm.test.tsx --no-coverage 2>&1 | tail -40
```

Expected: all tests pass

- [ ] **Step 8: Run full test suite**

```bash
cd C:/TEST/log-system && npm test -- --no-coverage 2>&1 | tail -20
```

Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add __tests__/LogForm.test.tsx
git commit -m "test: update LogForm tests for Log TSC / Log HRM split buttons"
```
