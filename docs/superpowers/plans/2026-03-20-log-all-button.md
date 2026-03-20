# Log All Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Log All (TSC + HRM)" button that fires both the TSC Excel log and HRM timesheet log in parallel with independent status reporting.

**Architecture:** All changes are confined to `components/LogForm.tsx` and its test file. The new `handleLogAll` handler fires `Promise.all` with two independent fetch IIFEs, each updating its own status state. Existing handlers get minor guard and dep array updates.

**Tech Stack:** React 18, Next.js 15 App Router, TypeScript strict, Jest + React Testing Library, `@testing-library/user-event`

---

## File Map

| File | Change |
|------|--------|
| `components/LogForm.tsx` | Remove cross-resets, add `isLogging` guards to existing handlers, add `handleLogAll`, update JSX layout |
| `__tests__/LogForm.test.tsx` | Remove 2 stale cross-reset tests, add 10 new tests for Log All |

---

## Task 1: Remove stale cross-reset tests

The two tests in `describe("LogForm -- cross-button state isolation")` test behavior that is intentionally removed — clicking Log TSC no longer resets HRM status, and vice versa. Delete them before writing new code so they do not create false failures.

**Files:**
- Modify: `__tests__/LogForm.test.tsx` (lines 643–696)

- [ ] **Step 1: Delete the cross-button state isolation describe block**

In `__tests__/LogForm.test.tsx`, delete the entire block from line 640 to line 696:

```
// ---------------------------------------------------------------------------
// Cross-button state isolation
// ---------------------------------------------------------------------------

describe("LogForm -- cross-button state isolation", () => {
  ... (two tests inside)
});
```

Also update the comment block at the top of the file (lines 1–26) — remove this line:
```
 * - Cross-button state isolation: clicking one log button resets the other's status.
```

- [ ] **Step 2: Run existing tests to confirm they still pass**

```bash
npx jest __tests__/LogForm.test.tsx --no-coverage
```

Expected: All remaining tests pass. No failures.

- [ ] **Step 3: Commit**

```bash
git add __tests__/LogForm.test.tsx
git commit -m "test: remove stale cross-reset isolation tests (behavior intentionally changed)"
```

---

## Task 2: Write failing tests — Log All disabled states

**Files:**
- Modify: `__tests__/LogForm.test.tsx`

- [ ] **Step 1: Add the new describe block for Log All disabled states**

Add this block after the `describe("LogForm -- Log HRM button disabled states")` block (after line 217):

```typescript
// ---------------------------------------------------------------------------
// Log All button disabled states
// ---------------------------------------------------------------------------

describe("LogForm -- Log All button disabled states", () => {
  it("is disabled before Jira verification", () => {
    render(<LogForm />);
    expect(screen.getByRole("button", { name: /log all/i })).toBeDisabled();
  });

  it("is disabled when Jira is verified but HRM ticket list is empty", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await verifySuccessFlow(user);
    expect(screen.getByRole("button", { name: /log all/i })).toBeDisabled();
  });

  it("is disabled when HRM has tickets but Jira is not verified", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");
    // Clear the current ticket to lose jira verification
    await typeTicket(user, "MDP-9999");
    expect(screen.getByRole("button", { name: /log all/i })).toBeDisabled();
  });

  it("is enabled when Jira is verified AND HRM list has tickets", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");
    // Re-verify the current ticket (addTicketToHrm leaves jiraStatus as success)
    expect(screen.getByRole("button", { name: /log all/i })).toBeEnabled();
  });

  it("is disabled while TSC log is in-flight", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    await user.click(screen.getByRole("button", { name: /log all/i }));

    expect(screen.getByRole("button", { name: /log all/i })).toBeDisabled();
  });

  it("is disabled while HRM log is in-flight", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    await user.click(screen.getByRole("button", { name: /log all/i }));

    expect(screen.getByRole("button", { name: /log all/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
npx jest __tests__/LogForm.test.tsx --no-coverage -t "Log All button disabled states"
```

Expected: All 6 tests FAIL — `Unable to find an accessible element with the role "button" and name /log all/i` (button doesn't exist yet).

---

## Task 3: Write failing tests — Log All parallel behavior

**Files:**
- Modify: `__tests__/LogForm.test.tsx`

- [ ] **Step 1: Add the new describe block for Log All behavior**

Add this block after the `describe("LogForm -- Log All button disabled states")` block:

```typescript
// ---------------------------------------------------------------------------
// Log All — parallel execution
// ---------------------------------------------------------------------------

describe("LogForm -- Log All parallel execution", () => {
  it("sets both logStatus and hrmStatus to loading before any fetch resolves", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    mockFetch.mockReturnValueOnce(pendingFetchResponse());
    await user.click(screen.getByRole("button", { name: /log all/i }));

    expect(screen.getByText("Writing to Excel... (browser will open briefly)")).toBeInTheDocument();
    expect(screen.getByText("Logging to HRM... (browser will open briefly)")).toBeInTheDocument();
  });

  it("fires both /api/sharepoint/log and /api/hrm/log when clicked", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, cell: "O66" }));
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
    await user.click(screen.getByRole("button", { name: /log all/i }));

    await waitFor(() => {
      const urls = mockFetch.mock.calls.map(([url]: [string]) => url);
      expect(urls).toContain("/api/sharepoint/log");
      expect(urls).toContain("/api/hrm/log");
    });
  });

  it("shows success on both status indicators when both operations succeed", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, cell: "O66" }));
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
    await user.click(screen.getByRole("button", { name: /log all/i }));

    await waitFor(() => {
      expect(screen.getByText(/Logged "MDP-1234" at cell O66/)).toBeInTheDocument();
      expect(screen.getByText(/Logged MDP-1234 to HRM timesheet/)).toBeInTheDocument();
    });
  });

  it("shows TSC success independently when HRM fails", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, cell: "O66" }));
    mockFetch.mockReturnValueOnce(jsonResponse({ success: false, error: "HRM error" }));
    await user.click(screen.getByRole("button", { name: /log all/i }));

    await waitFor(() => {
      expect(screen.getByText(/Logged "MDP-1234" at cell O66/)).toBeInTheDocument();
      expect(screen.getByText("HRM error")).toBeInTheDocument();
    });
  });

  it("shows HRM success independently when TSC fails", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    mockFetch.mockReturnValueOnce(jsonResponse({ success: false, error: "TSC error" }));
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
    await user.click(screen.getByRole("button", { name: /log all/i }));

    await waitFor(() => {
      expect(screen.getByText("TSC error")).toBeInTheDocument();
      expect(screen.getByText(/Logged MDP-1234 to HRM timesheet/)).toBeInTheDocument();
    });
  });

  it("resets both statuses to idle when ticket input changes after Log All", async () => {
    const user = userEvent.setup();
    render(<LogForm />);
    await addTicketToHrm(user, "MDP-1234", "Fix login bug");

    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, cell: "O66" }));
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
    await user.click(screen.getByRole("button", { name: /log all/i }));

    await waitFor(() =>
      expect(screen.getByText(/Logged "MDP-1234" at cell O66/)).toBeInTheDocument()
    );

    // Type a new ticket — both statuses should reset
    await typeTicket(user, "MDP-9999");

    expect(screen.queryByText(/Logged "MDP-1234"/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Logged MDP-1234 to HRM/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
npx jest __tests__/LogForm.test.tsx --no-coverage -t "Log All parallel execution"
```

Expected: All 6 tests FAIL — button not found.

- [ ] **Step 3: Update the test file header comment**

At the top of `__tests__/LogForm.test.tsx`, add these lines to the comment block (after `* - HRM multi-ticket: add to list, remove from list, send all.`):

```
 * - Log All: disabled when Jira not verified or HRM list empty or in-flight.
 * - Log All: fires both fetches in parallel, statuses update independently.
 * - Log All: both success, partial failure (TSC only, HRM only).
 * - Log All: input change resets both statuses after completion.
```

---

## Task 4: Implement — update existing handlers in LogForm.tsx

**Files:**
- Modify: `components/LogForm.tsx`

- [ ] **Step 1: Remove cross-reset from `handleLogTsc` and add `isLogging` guard**

Find `handleLogTsc` (around line 112). Current guard:
```typescript
if (jiraStatus.state !== "success") return;
```
Current line after guard:
```typescript
setLogStatus({ state: "loading" });
setHrmStatus({ state: "idle" });   // ← REMOVE THIS LINE
```
Current dep array:
```typescript
}, [ticket, selectedDate, jiraStatus.state]);
```

Make these three changes:

```typescript
// Guard becomes:
if (jiraStatus.state !== "success" || isLogging) return;

// Remove: setHrmStatus({ state: "idle" });

// Dep array becomes:
}, [ticket, selectedDate, jiraStatus.state, logStatus.state, hrmStatus.state]);
```

- [ ] **Step 2: Remove cross-reset from `handleLogHrm` and add `isLogging` guard**

Find `handleLogHrm` (around line 134). Current guard:
```typescript
if (hrmTickets.length === 0) return;
```
Current line after guard:
```typescript
setHrmStatus({ state: "loading" });
setLogStatus({ state: "idle" });   // ← REMOVE THIS LINE
```
Current dep array:
```typescript
}, [hrmTickets, selectedDate]);
```

Make these three changes:

```typescript
// Guard becomes:
if (hrmTickets.length === 0 || isLogging) return;

// Remove: setLogStatus({ state: "idle" });

// Dep array becomes:
}, [hrmTickets, selectedDate, logStatus.state, hrmStatus.state]);
```

- [ ] **Step 3: Run all tests to verify no regressions**

```bash
npx jest __tests__/LogForm.test.tsx --no-coverage
```

Expected: All previously passing tests still pass. The 12 new Log All tests still fail (button not rendered yet).

---

## Task 5: Implement — add `handleLogAll` and update JSX layout

**Files:**
- Modify: `components/LogForm.tsx`

- [ ] **Step 1: Add `handleLogAll` after `handleLogHrm`**

After the closing of `handleLogHrm` (around line 158), add:

```typescript
const handleLogAll = useCallback(async () => {
  if (jiraStatus.state !== "success" || hrmTickets.length === 0 || isLogging) return;

  setLogStatus({ state: "loading" });
  setHrmStatus({ state: "loading" });

  await Promise.all([
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
```

- [ ] **Step 2: Replace the action buttons JSX**

Find the action buttons section (around line 268):

```jsx
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
    disabled={!canAddToHrm || isLogging}
    onClick={handleAddToHrm}
    className="rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white
               hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
  >
    Add to HRM
  </button>
  <button
    type="button"
    disabled={hrmTickets.length === 0 || isLogging}
    onClick={handleLogHrm}
    className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white
               hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
  >
    Log HRM ({hrmTickets.length})
  </button>
</div>
```

Replace with:

```jsx
{/* Action buttons */}
<div className="flex flex-col gap-3">
  <button
    type="button"
    disabled={jiraStatus.state !== "success" || isLogging}
    onClick={handleLogTsc}
    className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white
               hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
  >
    Log TSC
  </button>
  <div className="flex gap-3">
    <button
      type="button"
      disabled={!canAddToHrm || isLogging}
      onClick={handleAddToHrm}
      className="flex-1 rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white
                 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Add to HRM
    </button>
    <button
      type="button"
      disabled={hrmTickets.length === 0 || isLogging}
      onClick={handleLogHrm}
      className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white
                 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Log HRM ({hrmTickets.length})
    </button>
  </div>
  <button
    type="button"
    disabled={jiraStatus.state !== "success" || hrmTickets.length === 0 || isLogging}
    onClick={handleLogAll}
    className="w-full rounded-md bg-purple-600 px-4 py-2.5 text-sm font-medium text-white
               hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
  >
    Log All (TSC + HRM)
  </button>
</div>
```

- [ ] **Step 3: Run all tests**

```bash
npx jest __tests__/LogForm.test.tsx --no-coverage
```

Expected: All tests pass, including the 12 new Log All tests.

If any test fails, check:
- The button text must contain "Log All" (the tests use `/log all/i`)
- `pendingFetchResponse` resolves to `{ success: false }` in cleanup — ensure two pending fetches are resolved after each test that fires Log All (the existing `afterEach` calls `resolvePendingFetch?.()` once, but Log All creates two pending fetches — see note below)

> **Note on `pendingFetchResponse` and Log All:** The current `pendingFetchResponse` helper only tracks one pending fetch. Tests that click "Log All" with two pending mocks will have one fetch resolve via `afterEach` cleanup and the other via the second `mockReturnValueOnce`. This is fine because both are mocked with `pendingFetchResponse()` — the second one will also resolve on cleanup. Confirm the tests don't hang; if they do, the issue is unresolved promises. The fix: call `resolvePendingFetch?.()` twice in the test or use `jsonResponse` for both mocks in tests that only care about the final state, not the in-flight state.

- [ ] **Step 4: Run the build to confirm no TypeScript errors**

```bash
npm run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add components/LogForm.tsx __tests__/LogForm.test.tsx
git commit -m "feat: add Log All button — fires TSC and HRM in parallel"
```

---

## Done

The feature is complete when:
- All tests in `__tests__/LogForm.test.tsx` pass
- `npm run build` succeeds
- The UI shows Log TSC (full-width), [Add to HRM][Log HRM(N)] (side by side), Log All (full-width purple) in a vertical column
