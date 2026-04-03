# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the TSC Daily Log System UI to dark mode with stacked section cards, subtle animations, and improved status feedback.

**Architecture:** Five files change — Tailwind config gains custom keyframes, `globals.css` and `page.tsx` update the page shell to dark, `StatusIndicator` gains a `fading` prop and dark colors, and `LogForm` gains four section cards, chip animations, and per-status fade-out state. No API routes or business logic change.

**Tech Stack:** Next.js 15, Tailwind CSS v3, React 18, TypeScript strict

---

## File Map

| File | Change |
|------|--------|
| `tailwind.config.ts` | Add `slideIn`, `shake`, `fadeOut` keyframes + animation utilities |
| `app/globals.css` | Update body to dark background |
| `app/page.tsx` | Remove white card wrapper, dark page shell |
| `components/StatusIndicator.tsx` | Dark colors, `fading` prop, transition classes, shake on error |
| `components/LogForm.tsx` | Four dark section cards, chip animations, fadingOut state, button press micro-interaction |
| `__tests__/LogForm.test.tsx` | Update 3 chip-removal assertions that need `waitFor` (chip exits after 150ms) |

---

## Task 1: Add custom Tailwind animation utilities

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Replace the theme.extend block**

Open `tailwind.config.ts`. The current `theme.extend` is empty. Replace it:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        slideIn: {
          "0%":   { opacity: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%":      { transform: "translateX(-4px)" },
          "40%":      { transform: "translateX(4px)" },
          "60%":      { transform: "translateX(-3px)" },
          "80%":      { transform: "translateX(3px)" },
        },
        fadeOut: {
          "0%":   { opacity: "1" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        "slide-in": "slideIn .18s ease-out",
        "shake":    "shake .35s ease-in-out",
        "fade-out": "fadeOut .5s ease-in forwards",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: add slide-in, shake, fade-out Tailwind animations"
```

---

## Task 2: Update page shell to dark mode

**Files:**
- Modify: `app/globals.css`
- Modify: `app/page.tsx`

- [ ] **Step 1: Update globals.css body styles**

Replace the body rule in `app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-slate-950 text-slate-100 min-h-screen;
}
```

- [ ] **Step 2: Replace page.tsx**

Full replacement for `app/page.tsx`:

```tsx
import LogForm from "@/components/LogForm";

function getFormattedDate(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  return formatter.format(now);
}

export default function Home() {
  const today = getFormattedDate();

  return (
    <main className="flex min-h-screen items-start justify-center bg-slate-950 px-4 pt-16">
      <div className="w-full max-w-lg">
        <h1 className="text-lg font-semibold text-slate-100">Welcome, Nam Nguyen</h1>
        <p className="mt-1 text-sm text-slate-500">Today: {today}</p>
        <div className="mt-6">
          <LogForm />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: successful build, no TypeScript or lint errors.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/page.tsx
git commit -m "feat: switch page shell to dark mode (slate-950)"
```

---

## Task 3: Restyle StatusIndicator for dark mode

**Files:**
- Modify: `components/StatusIndicator.tsx`

- [ ] **Step 1: Replace StatusIndicator.tsx**

Full replacement:

```tsx
"use client";

type Status = "idle" | "loading" | "success" | "error";

interface StatusIndicatorProps {
  label: string;
  status: Status;
  message?: string;
  fading?: boolean;
}

export default function StatusIndicator({
  label,
  status,
  message,
  fading = false,
}: StatusIndicatorProps) {
  return (
    <div
      className={`flex items-start gap-2 text-sm transition-all duration-200${
        status === "error" ? " animate-shake" : ""
      }`}
    >
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-medium text-slate-400">{label}:</span>

        {status === "idle" && (
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-600 transition-colors duration-300" />
        )}

        {status === "loading" && (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
        )}

        {status === "success" && (
          <span className="font-semibold text-green-500 transition-colors duration-300">&#10003;</span>
        )}

        {status === "error" && (
          <span className="font-semibold text-red-500">&#10005;</span>
        )}
      </div>

      {message && (
        <span
          className={
            "min-w-0 break-words transition-opacity duration-500 " +
            (fading ? "opacity-0 " : "opacity-100 ") +
            (status === "success"
              ? "text-green-400"
              : status === "error"
                ? "text-red-400"
                : status === "loading"
                  ? "text-blue-400"
                  : "text-slate-500")
          }
        >
          {message}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run StatusIndicator tests**

```bash
npx jest __tests__/StatusIndicator.test.tsx --no-coverage
```

Expected: all pass. These tests check behavior (role, text, aria), not class names.

- [ ] **Step 3: Commit**

```bash
git add components/StatusIndicator.tsx
git commit -m "feat: restyle StatusIndicator for dark mode, add fading prop"
```

---

## Task 4: Add fadingOut state to LogForm

**Files:**
- Modify: `components/LogForm.tsx` (state + useEffect changes only — no JSX changes yet)

This task adds three `fadingOut` booleans and updates the success `useEffect` timers so the status message visually fades before clearing. No visual change to render output yet since `StatusIndicator` will only receive `fading` in a later step.

- [ ] **Step 1: Add fadingOut state declarations**

After the existing `const [stagedTickets, ...]` line (line 64), add:

```tsx
const [jiraFading, setJiraFading] = useState(false);
const [logFading, setLogFading] = useState(false);
const [hrmFading, setHrmFading] = useState(false);
```

- [ ] **Step 2: Replace the Jira success useEffect**

Replace the existing Jira success timer (currently lines ~154-158):

```tsx
// Before:
useEffect(() => {
  if (jiraStatus.state !== "success") return;
  const id = setTimeout(() => setJiraStatus({ state: "idle" }), 20000);
  return () => clearTimeout(id);
}, [jiraStatus.state]);
```

With:

```tsx
useEffect(() => {
  if (jiraStatus.state !== "success") return;
  const fadeId = setTimeout(() => setJiraFading(true), 19500);
  const clearId = setTimeout(() => {
    setJiraStatus({ state: "idle" });
    setJiraFading(false);
  }, 20000);
  return () => {
    clearTimeout(fadeId);
    clearTimeout(clearId);
  };
}, [jiraStatus.state]);
```

- [ ] **Step 3: Replace the TSC Log success useEffect**

Replace the existing logStatus timer:

```tsx
// Before:
useEffect(() => {
  if (logStatus.state !== "success") return;
  const id = setTimeout(() => setLogStatus({ state: "idle" }), 10000);
  return () => clearTimeout(id);
}, [logStatus.state]);
```

With:

```tsx
useEffect(() => {
  if (logStatus.state !== "success") return;
  const fadeId = setTimeout(() => setLogFading(true), 9500);
  const clearId = setTimeout(() => {
    setLogStatus({ state: "idle" });
    setLogFading(false);
  }, 10000);
  return () => {
    clearTimeout(fadeId);
    clearTimeout(clearId);
  };
}, [logStatus.state]);
```

- [ ] **Step 4: Replace the HRM Log success useEffect**

Replace the existing hrmStatus timer:

```tsx
// Before:
useEffect(() => {
  if (hrmStatus.state !== "success") return;
  const id = setTimeout(() => setHrmStatus({ state: "idle" }), 10000);
  return () => clearTimeout(id);
}, [hrmStatus.state]);
```

With:

```tsx
useEffect(() => {
  if (hrmStatus.state !== "success") return;
  const fadeId = setTimeout(() => setHrmFading(true), 9500);
  const clearId = setTimeout(() => {
    setHrmStatus({ state: "idle" });
    setHrmFading(false);
  }, 10000);
  return () => {
    clearTimeout(fadeId);
    clearTimeout(clearId);
  };
}, [hrmStatus.state]);
```

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all pass. The useEffect timer logic is the same behavior at the assertion level — tests use fake timers or don't advance time 10s+.

- [ ] **Step 6: Commit**

```bash
git add components/LogForm.tsx
git commit -m "feat: add per-status fadingOut state and staggered timers in LogForm"
```

---

## Task 5: Restyle LogForm JSX to dark stacked cards

**Files:**
- Modify: `components/LogForm.tsx` (JSX only — replace the return block)

- [ ] **Step 1: Replace the LogForm return block**

Replace everything from `return (` through the final `);` at the end of the component with:

```tsx
  return (
    <div className="space-y-2.5">
      {/* Tickets card */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            {stagedTickets.length > 0 ? `Tickets (${stagedTickets.length}/5)` : "Tickets"}
          </p>
          {stagedTickets.length > 0 && (
            <button
              type="button"
              onClick={() => setStagedTickets([])}
              className="text-xs text-slate-500 hover:text-red-400"
            >
              Clear All
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="ticket" className="text-sm font-medium text-slate-400">
            Ticket:
          </label>
          <input
            id="ticket"
            type="text"
            placeholder="MDP-1234 or MDP-1234, MDP-5678"
            value={ticket}
            onChange={handleTicketChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isTicketValid && jiraStatus.state !== "loading") {
                handleVerify();
              }
            }}
            className={`flex-1 rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 ${
              showFormatError
                ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                : "border-slate-700 focus:border-blue-500 focus:ring-blue-500"
            }`}
          />
          <button
            type="button"
            disabled={!isTicketValid || jiraStatus.state === "loading"}
            onClick={handleVerify}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white
                       active:scale-95 transition-transform duration-100
                       hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Verify
          </button>
        </div>
        {showFormatError && (
          <p className="text-xs text-red-400">Use MDP-xxxx format</p>
        )}
        <StatusIndicator
          label="Jira"
          status={jiraStatus.state}
          fading={jiraFading}
          message={
            jiraStatus.state === "success" || jiraStatus.state === "error"
              ? jiraStatus.message
              : jiraStatus.state === "loading"
                ? "Verifying..."
                : undefined
          }
        />
        {stagedTickets.length > 0 && (
          <ul className="space-y-1.5">
            {stagedTickets.map((item) => {
              const description = item.summary.slice(item.ticket.length + 3);
              return (
                <li
                  key={item.ticket}
                  className="animate-slide-in flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                >
                  <span className="flex flex-col min-w-0">
                    <span className="font-medium text-slate-200">{item.ticket}</span>
                    {description && (
                      <span className="truncate text-xs text-slate-500">{description}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFromStaged(item.ticket)}
                    className="ml-3 shrink-0 rounded p-1 text-slate-600 hover:bg-slate-700 hover:text-red-400"
                    aria-label={`Remove ${item.ticket}`}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Dates card */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Dates</p>
        <div className="flex items-center gap-3">
          <label htmlFor="log-date" className="text-sm font-medium text-slate-400">
            Date:
          </label>
          <input
            id="log-date"
            type="date"
            value={stagingDate}
            min={min}
            max={max}
            onChange={handleStagingDateChange}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200
                       focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            disabled={!stagingDate || logDates.includes(stagingDate)}
            onClick={handleAddDate}
            className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm font-medium text-slate-300
                       active:scale-95 transition-transform duration-100
                       hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add
          </button>
        </div>
        {logDates.length > 0 && (
          <ul className="space-y-1.5">
            {logDates.map((d) => (
              <li
                key={d}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              >
                <span className="text-slate-300">{formatDateDisplay(d)}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveDate(d)}
                  className="ml-2 shrink-0 rounded p-1 text-slate-600 hover:bg-slate-700 hover:text-red-400"
                  aria-label={`Remove date ${d}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Status card */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Status</p>
        <StatusIndicator
          label="TSC Log"
          status={logStatus.state}
          fading={logFading}
          message={
            logStatus.state === "success" || logStatus.state === "error"
              ? logStatus.message
              : logStatus.state === "loading"
                ? "Writing to Excel... (browser will open briefly)"
                : undefined
          }
        />
        <StatusIndicator
          label="HRM Log"
          status={hrmStatus.state}
          fading={hrmFading}
          message={
            hrmStatus.state === "success" || hrmStatus.state === "error"
              ? hrmStatus.message
              : hrmStatus.state === "loading"
                ? "Logging to HRM... (browser will open briefly)"
                : undefined
          }
        />
        {stagedTickets.length > 0 && logDates.length > 0 && (
          <div className="rounded-lg border border-blue-900/50 border-l-[3px] border-l-blue-500 bg-blue-950/30 px-4 py-3 text-sm">
            <p className="font-medium text-blue-300">Will log:</p>
            <p className="mt-1 text-blue-400">
              {stagedTickets.map((t) => t.ticket).join(", ")}
            </p>
            <p className="text-blue-500">
              on {logDates.map((d) => formatDateDisplay(d)).join(", ")}
            </p>
          </div>
        )}
      </div>

      {/* Actions card */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Actions</p>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            disabled={stagedTickets.length === 0 || logDates.length === 0 || isLogging}
            onClick={handleLogTsc}
            className="w-full rounded-lg border border-blue-600 bg-transparent px-4 py-2.5 text-sm font-medium text-blue-400
                       active:scale-95 transition-transform duration-100
                       hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Log TSC
          </button>
          <button
            type="button"
            disabled={stagedTickets.length === 0 || isLogging}
            onClick={handleLogHrm}
            className="w-full rounded-lg border border-teal-600 bg-transparent px-4 py-2.5 text-sm font-medium text-teal-400
                       active:scale-95 transition-transform duration-100
                       hover:bg-teal-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Log HRM ({stagedTickets.length})
          </button>
          <button
            type="button"
            disabled={stagedTickets.length === 0 || isLogging}
            onClick={handleLogAll}
            className="w-full rounded-lg bg-violet-700 px-4 py-3 text-sm font-medium text-white
                       active:scale-95 transition-transform duration-100
                       hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {logAllLabel}
          </button>
        </div>
      </div>
    </div>
  );
```

- [ ] **Step 2: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all pass. Tests query by role/placeholder/text — none depend on CSS class names.

- [ ] **Step 3: Run dev server and visually verify**

```bash
npm run dev
```

Open http://localhost:3000. Confirm: dark slate background, four separate cards visible (Tickets, Dates, Status, Actions).

- [ ] **Step 4: Commit**

```bash
git add components/LogForm.tsx
git commit -m "feat: restyle LogForm with dark stacked section cards"
```

---

## Task 6: Add chip entry and exit animations

**Files:**
- Modify: `components/LogForm.tsx`
- Modify: `__tests__/LogForm.test.tsx`

The entry animation (`animate-slide-in`) is already on the chips from Task 5. This task adds the exit animation: chips fade and slide up over 150ms before being removed from state.

- [ ] **Step 1: Add exitingTickets state**

After the `stagedTickets` state declaration in `LogForm.tsx`, add:

```tsx
const [exitingTickets, setExitingTickets] = useState<Set<string>>(new Set());
```

- [ ] **Step 2: Replace handleRemoveFromStaged**

Replace the existing `handleRemoveFromStaged` callback:

```tsx
// Before:
const handleRemoveFromStaged = useCallback((ticketId: string) => {
  setStagedTickets((prev) => prev.filter((t) => t.ticket !== ticketId));
}, []);
```

With:

```tsx
const handleRemoveFromStaged = useCallback((ticketId: string) => {
  setExitingTickets((prev) => new Set([...prev, ticketId]));
  setTimeout(() => {
    setStagedTickets((prev) => prev.filter((t) => t.ticket !== ticketId));
    setExitingTickets((prev) => {
      const next = new Set(prev);
      next.delete(ticketId);
      return next;
    });
  }, 150);
}, []);
```

- [ ] **Step 3: Add exit classes to ticket chip li**

Update the `<li>` in the staged tickets map (added in Task 5) to conditionally apply exit animation classes:

```tsx
// Before:
<li
  key={item.ticket}
  className="animate-slide-in flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
>

// After:
<li
  key={item.ticket}
  className={`flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm transition-all duration-150 ${
    exitingTickets.has(item.ticket) ? "opacity-0 -translate-y-1.5" : "animate-slide-in"
  }`}
>
```

- [ ] **Step 4: Update the three failing tests in LogForm.test.tsx**

Three tests immediately assert chip absence right after clicking Remove, but with the 150ms exit delay the chip is still in the DOM (opacity-0). Update them to use `waitFor`.

**Test 1** — "removes a ticket from the HRM list" (around line 516):

```tsx
// Before:
await user.click(screen.getByRole("button", { name: /remove MDP-1234/i }));
expect(screen.queryByText("MDP-1234")).not.toBeInTheDocument();

// After:
await user.click(screen.getByRole("button", { name: /remove MDP-1234/i }));
await waitFor(
  () => expect(screen.queryByText("MDP-1234")).not.toBeInTheDocument(),
  { timeout: 500 }
);
```

**Test 2** — "is disabled when all staged tickets are removed after verification" (around line 721):

```tsx
// Before:
await user.click(screen.getByRole("button", { name: /remove MDP-1234/i }));
expect(screen.getByRole("button", { name: /log all/i })).toBeDisabled();

// After:
await user.click(screen.getByRole("button", { name: /remove MDP-1234/i }));
await waitFor(
  () => expect(screen.getByRole("button", { name: /log all/i })).toBeDisabled(),
  { timeout: 500 }
);
```

**Test 3** — "is disabled when staged list is empty" (around line 730):

```tsx
// Before:
await user.click(screen.getByRole("button", { name: /remove MDP-1234/i }));
expect(screen.getByRole("button", { name: /log all/i })).toBeDisabled();

// After:
await user.click(screen.getByRole("button", { name: /remove MDP-1234/i }));
await waitFor(
  () => expect(screen.getByRole("button", { name: /log all/i })).toBeDisabled(),
  { timeout: 500 }
);
```

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add components/LogForm.tsx __tests__/LogForm.test.tsx
git commit -m "feat: add chip entry/exit animations with 150ms exit delay"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full test suite with coverage**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Production build**

```bash
npm run build
```

Expected: no errors or warnings.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Verify in browser:
- [ ] Page background is dark (slate-950)
- [ ] Four cards visible: Tickets, Dates, Status, Actions
- [ ] Ticket input has dark bg, correct placeholder
- [ ] Verify button click shows blue spinner in Jira status row
- [ ] Verified ticket chip slides in with animation
- [ ] Clicking chip X: chip fades/slides up then disappears
- [ ] Date picker and date chips show dark styling
- [ ] Log TSC/HRM/All buttons show press micro-interaction (scale down on click)
- [ ] Error status row shakes once
- [ ] Success message fades out before clearing
