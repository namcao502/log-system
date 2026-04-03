# Live Log Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream Playwright log lines to the UI in real time as browser operations run, instead of waiting for the full operation to finish.

**Architecture:** Browser scripts emit logs via an `onLog` callback instead of collecting them. API routes wrap operations in a `TransformStream` and flush NDJSON lines to the client as they arrive. The frontend reads the stream incrementally with a shared `readNdJsonStream` helper and appends log lines live.

**Tech Stack:** Next.js 15 App Router, TypeScript strict mode, `TransformStream` / `ReadableStream` (Web Streams API, native in Node 22 + jsdom), Jest 29 + React Testing Library

---

## File Map

| File | Change |
|------|--------|
| `lib/types.ts` | Add `LogStreamLine`, `HrmStreamLine` union types |
| `lib/browser-log.ts` | Add `onLog?` param to `writeTicketViaPlaywright`; change all internal helpers from `logs: string[]` to `emit: (line: string) => void` |
| `lib/browser-hrm.ts` | Add `onLog?` param to `logTicketsToHrm`; same internal helper change |
| `app/api/sharepoint/log/route.ts` | Return `Response` with `ReadableStream` body instead of `NextResponse.json` |
| `app/api/hrm/log/route.ts` | Same streaming pattern |
| `components/LogForm.tsx` | Add `readNdJsonStream` helper; update `handleLogTsc`, `handleLogHrm`, `handleLogAll` |
| `__tests__/LogForm.test.tsx` | Add `streamResponse` helper; update 19 `jsonResponse` log-op mocks to `streamResponse` |

---

## Task 1: Add Stream Types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add the two union types at the end of `lib/types.ts`**

```typescript
// lib/types.ts — append after existing exports

export type LogStreamLine =
  | { type: "log"; data: string }
  | { type: "result"; success: true; cell: string }
  | { type: "result"; success: false; cell?: string; error: string };

export type HrmStreamLine =
  | { type: "log"; data: string }
  | { type: "result"; success: true }
  | { type: "result"; success: false; error: string };
```

- [ ] **Step 2: Verify build still passes**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors (only the existing unused-var warning in browser-hrm.ts is acceptable).

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add LogStreamLine and HrmStreamLine types for NDJSON streaming"
```

---

## Task 2: Update Tests to Expect Streaming (RED)

**Files:**
- Modify: `__tests__/LogForm.test.tsx`

All 19 log-operation test cases that currently use `jsonResponse(...)` for `/api/sharepoint/log` or `/api/hrm/log` calls need to switch to `streamResponse(...)`. Jira verify tests (`jsonResponse({ valid: ... })`) are unchanged. Network-error tests (`mockRejectedValueOnce`) and loading-state tests (`pendingFetchResponse`) are unchanged.

- [ ] **Step 1: Add `streamResponse` helper after `jsonResponse` (around line 76)**

```typescript
function streamResponse(lines: object[], status = 200): Promise<Response> {
  const text = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return Promise.resolve(new Response(body, { status }));
}
```

- [ ] **Step 2: Update all TSC log test mocks**

Find and replace each `jsonResponse(...)` call for `/api/sharepoint/log` responses:

**"shows cell info on successful log"** (Log TSC happy path):
```typescript
// Before:
mockFetch.mockReturnValueOnce(
  jsonResponse({ success: true, cell: "O66" })
);
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: true, cell: "O66" }])
);
```

**"sends POST to /api/sharepoint/log..."**:
```typescript
// Before:
mockFetch.mockReturnValueOnce(
  jsonResponse({ success: true, cell: "O66" })
);
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: true, cell: "O66" }])
);
```

**"shows error when log API returns failure"**:
```typescript
// Before:
mockFetch.mockReturnValueOnce(
  jsonResponse({ success: false, error: "Browser automation failed" })
);
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: false, error: "Browser automation failed" }])
);
```

**"shows fallback error when success is false and no error message"** (TSC):
```typescript
// Before:
mockFetch.mockReturnValueOnce(jsonResponse({ success: false }));
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: false, error: "" }])
);
```

> Note: `error: ""` ensures `result.error ?? "Failed to log"` falls back to "Failed to log" since empty string is falsy.

**"Log TSC sends the selected date"**:
```typescript
// Before:
mockFetch.mockReturnValueOnce(jsonResponse({ success: true, cell: "O15" }));
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: true, cell: "O15" }])
);
```

- [ ] **Step 3: Update all HRM log test mocks**

**"shows success message on successful HRM log"**:
```typescript
// Before:
mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: true }])
);
```

**"sends POST to /api/hrm/log with tickets array and date in body"**:
```typescript
// Before:
mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: true }])
);
```

**"sends multiple tickets when multiple are added to HRM list"**:
```typescript
// Before:
mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: true }])
);
```

**"shows error when HRM API returns failure"**:
```typescript
// Before:
mockFetch.mockReturnValueOnce(
  jsonResponse({ success: false, error: "HRM automation failed" })
);
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: false, error: "HRM automation failed" }])
);
```

**"shows fallback error when success is false and no error message"** (HRM):
```typescript
// Before:
mockFetch.mockReturnValueOnce(jsonResponse({ success: false }));
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: false, error: "" }])
);
```

**"Log HRM sends the selected date"**:
```typescript
// Before:
mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: true }])
);
```

- [ ] **Step 4: Update Log All test mocks**

**"fires both /api/sharepoint/log and /api/hrm/log when clicked"**:
```typescript
// Before:
mockFetch.mockReturnValueOnce(jsonResponse({ success: true, cell: "O66" }));
mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: true, cell: "O66" }])
);
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: true }])
);
```

**"shows success on both status indicators when both operations succeed"**:
```typescript
// Before:
mockFetch.mockReturnValueOnce(jsonResponse({ success: true, cell: "O66" }));
mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: true, cell: "O66" }])
);
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: true }])
);
```

**"shows TSC success independently when HRM fails"**:
```typescript
// Before:
mockFetch.mockReturnValueOnce(jsonResponse({ success: true, cell: "O66" }));
mockFetch.mockReturnValueOnce(jsonResponse({ success: false, error: "HRM error" }));
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: true, cell: "O66" }])
);
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: false, error: "HRM error" }])
);
```

**"shows HRM success independently when TSC fails"**:
```typescript
// Before:
mockFetch.mockReturnValueOnce(jsonResponse({ success: false, error: "TSC error" }));
mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: false, error: "TSC error" }])
);
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: true }])
);
```

**"resets both statuses to idle when ticket input changes after Log All"**:
```typescript
// Before:
mockFetch.mockReturnValueOnce(jsonResponse({ success: true, cell: "O66" }));
mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: true, cell: "O66" }])
);
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: true }])
);
```

- [ ] **Step 5: Update log banner tests**

**"shows log toggle on TSC Log row after successful log"**:
```typescript
// Before:
mockFetch.mockReturnValueOnce(
  jsonResponse({
    success: true,
    cell: "M95",
    logs: ["[browser-log] [0.0s] Browser launched", "[browser-log] [2.1s] Done!"],
  })
);
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([
    { type: "log", data: "[browser-log] [0.0s] Browser launched" },
    { type: "log", data: "[browser-log] [2.1s] Done!" },
    { type: "result", success: true, cell: "M95" },
  ])
);
```

**"shows log toggle on HRM Log row after successful HRM log"**:
```typescript
// Before:
mockFetch.mockReturnValueOnce(
  jsonResponse({
    success: true,
    logs: ["[hrm-log] [0.0s] Browser launched", "[hrm-log] [3.2s] Done!"],
  })
);
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([
    { type: "log", data: "[hrm-log] [0.0s] Browser launched" },
    { type: "log", data: "[hrm-log] [3.2s] Done!" },
    { type: "result", success: true },
  ])
);
```

**"resets logs when a new TSC log operation starts"** — two log calls in this test:
```typescript
// Before (first log call):
mockFetch.mockReturnValueOnce(
  jsonResponse({ success: true, cell: "M95", logs: ["[browser-log] [0.0s] Browser launched"] })
);
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([
    { type: "log", data: "[browser-log] [0.0s] Browser launched" },
    { type: "result", success: true, cell: "M95" },
  ])
);

// Before (second log call — no logs):
mockFetch.mockReturnValueOnce(jsonResponse({ success: true, cell: "M96" }));
// After:
mockFetch.mockReturnValueOnce(
  streamResponse([{ type: "result", success: true, cell: "M96" }])
);
```

- [ ] **Step 6: Run tests — expect failures**

```bash
npx jest __tests__/LogForm.test.tsx 2>&1 | tail -20
```

Expected: Multiple failures in log-operation tests because the handlers still use `res.json()` instead of reading the stream. Verify, Jira-error, HRM-list-management, date-picker, loading-state, and Log-All-disabled tests should still pass.

---

## Task 3: Implement `readNdJsonStream` and Update Handlers (GREEN)

**Files:**
- Modify: `components/LogForm.tsx`

- [ ] **Step 1: Add `readNdJsonStream` as a module-level function before `LogForm` (after the helper functions, around line 56)**

```typescript
async function readNdJsonStream(
  body: ReadableStream<Uint8Array>,
  onLog: (line: string) => void
): Promise<{ success: boolean; cell?: string; error?: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line) as {
        type: string;
        data?: string;
        success?: boolean;
        cell?: string;
        error?: string;
      };
      if (msg.type === "log" && msg.data !== undefined) {
        onLog(msg.data);
      } else if (msg.type === "result") {
        return { success: msg.success ?? false, cell: msg.cell, error: msg.error };
      }
    }
  }
  return { success: false, error: "Stream ended unexpectedly" };
}
```

- [ ] **Step 2: Replace `handleLogTsc` (around line 207)**

```typescript
const handleLogTsc = useCallback(async () => {
  if (stagedTickets.length === 0 || isLogging) return;

  const tscTicket = stagedTickets.map((t) => t.ticket).join(", ");

  setLogStatus({ state: "loading" });
  setTscLogs([]);
  try {
    const res = await fetch("/api/sharepoint/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket: tscTicket, dates: logDates }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setLogStatus({ state: "error", message: data.error ?? "Failed to log" });
      return;
    }
    if (!res.body) {
      setLogStatus({ state: "error", message: "Failed to log" });
      return;
    }
    const result = await readNdJsonStream(res.body, (line) =>
      setTscLogs((prev) => [...prev, line])
    );
    if (result.success) {
      setLogStatus({ state: "success", message: `Logged "${tscTicket}" at cell ${result.cell ?? "O"}` });
      setStagedTickets([]);
    } else {
      setLogStatus({ state: "error", message: result.error || "Failed to log" });
    }
  } catch {
    setLogStatus({ state: "error", message: "Failed to write to Excel" });
  }
}, [stagedTickets, logDates, isLogging]);
```

- [ ] **Step 3: Replace `handleLogHrm` (around line 234)**

```typescript
const handleLogHrm = useCallback(async () => {
  if (stagedTickets.length === 0 || isLogging) return;

  setHrmStatus({ state: "loading" });
  setHrmLogs([]);
  try {
    const res = await fetch("/api/hrm/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tickets: stagedTickets.map((t) => t.ticket),
        dates: logDates,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setHrmStatus({ state: "error", message: data.error ?? "Failed to log to HRM" });
      return;
    }
    if (!res.body) {
      setHrmStatus({ state: "error", message: "Failed to log to HRM" });
      return;
    }
    const result = await readNdJsonStream(res.body, (line) =>
      setHrmLogs((prev) => [...prev, line])
    );
    if (result.success) {
      const ticketIds = stagedTickets.map((t) => t.ticket).join(", ");
      setHrmStatus({ state: "success", message: `Logged ${ticketIds} to HRM timesheet` });
      setStagedTickets([]);
    } else {
      setHrmStatus({ state: "error", message: result.error || "Failed to log to HRM" });
    }
  } catch {
    setHrmStatus({ state: "error", message: "Failed to reach HRM" });
  }
}, [stagedTickets, logDates, isLogging]);
```

- [ ] **Step 4: Replace `handleLogAll` (around line 263)**

```typescript
const handleLogAll = useCallback(async () => {
  if (stagedTickets.length === 0 || isLogging) return;

  const tscTicket = stagedTickets.map((t) => t.ticket).join(", ");

  setLogStatus({ state: "loading" });
  setHrmStatus({ state: "loading" });
  setTscLogs([]);
  setHrmLogs([]);

  await Promise.all([
    (async () => {
      try {
        const res = await fetch("/api/sharepoint/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket: tscTicket, dates: logDates }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string };
          setLogStatus({ state: "error", message: data.error ?? "Failed to log" });
          return;
        }
        if (!res.body) {
          setLogStatus({ state: "error", message: "Failed to log" });
          return;
        }
        const result = await readNdJsonStream(res.body, (line) =>
          setTscLogs((prev) => [...prev, line])
        );
        if (result.success) {
          setLogStatus({ state: "success", message: `Logged "${tscTicket}" at cell ${result.cell ?? "O"}` });
          setStagedTickets([]);
        } else {
          setLogStatus({ state: "error", message: result.error || "Failed to log" });
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
          body: JSON.stringify({ tickets: stagedTickets.map((t) => t.ticket), dates: logDates }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string };
          setHrmStatus({ state: "error", message: data.error ?? "Failed to log to HRM" });
          return;
        }
        if (!res.body) {
          setHrmStatus({ state: "error", message: "Failed to log to HRM" });
          return;
        }
        const result = await readNdJsonStream(res.body, (line) =>
          setHrmLogs((prev) => [...prev, line])
        );
        if (result.success) {
          const ticketIds = stagedTickets.map((t) => t.ticket).join(", ");
          setHrmStatus({ state: "success", message: `Logged ${ticketIds} to HRM timesheet` });
          setStagedTickets([]);
        } else {
          setHrmStatus({ state: "error", message: result.error || "Failed to log to HRM" });
        }
      } catch {
        setHrmStatus({ state: "error", message: "Failed to reach HRM" });
      }
    })(),
  ]);
}, [logDates, stagedTickets, isLogging]);
```

- [ ] **Step 5: Run all tests — expect all 63 to pass**

```bash
npx jest __tests__/LogForm.test.tsx 2>&1 | tail -10
```

Expected:
```
Tests: 63 passed, 63 total
```

- [ ] **Step 6: Commit**

```bash
git add __tests__/LogForm.test.tsx components/LogForm.tsx
git commit -m "feat: stream logs live in LogForm via readNdJsonStream"
```

---

## Task 4: Add `onLog` Callback to `lib/browser-log.ts`

**Files:**
- Modify: `lib/browser-log.ts`

The pattern: replace `logs: string[]` with `emit: (line: string) => void` in every internal function. In `writeTicketViaPlaywright`, create `emit` that pushes to the local `logs` array AND calls `onLog`. Pass `emit` to all internal helpers.

- [ ] **Step 1: Update `getCellForDate` signature and body**

```typescript
function getCellForDate(date: Date, emit: (line: string) => void): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  const day = Number(parts.find((p) => p.type === "day")!.value);

  const dateUtc = Date.UTC(year, month - 1, day);
  const startUtc = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor((dateUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;

  const row = HEADER_ROWS + dayOfYear;
  emit(`[browser-log] Date: ${year}-${month}-${day}, dayOfYear: ${dayOfYear}, row: ${row}`);
  return `${TARGET_COLUMN}${row}`;
}
```

- [ ] **Step 2: Update `getExcelFrame` signature and body**

```typescript
async function getExcelFrame(page: Page, emit: (line: string) => void): Promise<Frame> {
  const iframeSelectors = [
    "#WacFrame_Excel_0",
    "iframe[id*='WacFrame']",
    "iframe[id*='Excel']",
    "iframe",
  ];

  for (const selector of iframeSelectors) {
    try {
      const iframeEl = await page.waitForSelector(selector, { timeout: 3000 });
      if (iframeEl) {
        const frame = await iframeEl.contentFrame();
        if (frame) {
          emit(`[browser-log] Found Excel iframe via: ${selector}`);
          return frame;
        }
      }
    } catch {
      continue;
    }
  }

  emit("[browser-log] No iframe found, using main page frame");
  return page.mainFrame();
}
```

- [ ] **Step 3: Update `navigateToCell` signature and body**

```typescript
async function navigateToCell(
  page: Page,
  frame: Frame,
  cellAddress: string,
  emit: (line: string) => void
): Promise<boolean> {
  const nameBox = frame.locator("[id*='NameBox'] input").first();
  try {
    await nameBox.waitFor({ state: "visible", timeout: 5000 });
  } catch {
    emit("[browser-log] Name Box not found");
    return false;
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    emit(`[browser-log] Nav attempt ${attempt} → ${cellAddress}`);

    await frame.evaluate(() => {
      const nb = document.querySelector("[id*='NameBox'] input") as HTMLInputElement;
      if (nb) {
        nb.focus();
        nb.select();
      }
    });
    await page.waitForTimeout(500);
    await page.keyboard.type(cellAddress, { delay: 50 });
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

    const nbValue = (await nameBox.inputValue().catch(() => "")).trim().toUpperCase();
    emit(`[browser-log] Name Box after nav: "${nbValue}"`);

    if (nbValue === cellAddress.toUpperCase()) {
      emit(`[browser-log] Navigated to ${cellAddress}`);
      return true;
    }

    emit(`[browser-log] Expected "${cellAddress}", got "${nbValue}" — retrying`);
    await page.waitForTimeout(500);
  }

  emit(`[browser-log] Nav verification failed after 3 attempts`);
  return false;
}
```

- [ ] **Step 4: Update `attemptWrite` signature and body**

```typescript
async function attemptWrite(
  ticket: string,
  cellAddresses: string[],
  elapsed: () => string,
  emit: (line: string) => void
): Promise<{ success: boolean; cell: string; error?: string }> {
  let context: BrowserContext | null = null;
  const cellsLabel = cellAddresses.join(", ");

  try {
    context = await chromium.launchPersistentContext(PLAYWRIGHT_PROFILE_DIR, {
      channel: "msedge",
      headless: false,
      args: ["--disable-blink-features=AutomationControlled"],
      viewport: { width: 1280, height: 800 },
    });
    emit(`[browser-log] [${elapsed()}] Browser launched`);

    const page = context.pages()[0] || (await context.newPage());

    await page.goto(EXCEL_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    emit(`[browser-log] [${elapsed()}] DOM loaded`);

    const frame = await getExcelFrame(page, emit);
    emit(`[browser-log] [${elapsed()}] Iframe found`);

    try {
      await frame.waitForSelector("[id*='NameBox'] input", { timeout: 30000 });
      emit(`[browser-log] [${elapsed()}] Name Box visible`);
      await frame.waitForSelector("[id*='formulaBar'] [contenteditable]", { timeout: 10000 });
      emit(`[browser-log] [${elapsed()}] Formula bar visible`);
    } catch {
      emit(`[browser-log] [${elapsed()}] Excel UI not fully detected, continuing...`);
    }
    await page.waitForTimeout(3000);
    emit(`[browser-log] [${elapsed()}] Excel ready`);

    const formulaBar = frame.locator("[id*='formulaBar'] [contenteditable]").first();

    for (const cellAddress of cellAddresses) {
      const navSuccess = await navigateToCell(page, frame, cellAddress, emit);
      emit(`[browser-log] [${elapsed()}] Nav done → ${cellAddress}`);
      if (!navSuccess) {
        await context.close();
        return { success: false, cell: cellsLabel, error: `Could not navigate to target cell ${cellAddress}.` };
      }

      await formulaBar.click();
      await page.waitForTimeout(500);

      const currentValue = (await formulaBar.textContent())?.trim() ?? "";
      emit(`[browser-log] [${elapsed()}] ${cellAddress} value: "${currentValue}"`);

      if (currentValue.includes(ticket)) {
        emit(`[browser-log] [${elapsed()}] "${ticket}" already in ${cellAddress}, skipping`);
        await page.keyboard.press("Escape");
        continue;
      }

      const hasValidContent = currentValue && /MDP-\d+/.test(currentValue);
      const newValue = hasValidContent ? `${currentValue}, ${ticket}` : ticket;

      await formulaBar.press("Control+a");
      await page.waitForTimeout(300);
      await formulaBar.pressSequentially(newValue, { delay: 50 });
      await page.waitForTimeout(500);
      emit(`[browser-log] [${elapsed()}] Typed "${newValue}" into ${cellAddress}`);

      const fbAfter = (await formulaBar.textContent())?.trim() ?? "";
      emit(`[browser-log] Formula bar after typing: "${fbAfter}"`);

      await formulaBar.press("Enter");
      emit(`[browser-log] [${elapsed()}] Committed ${cellAddress}`);

      if (cellAddresses.indexOf(cellAddress) < cellAddresses.length - 1) {
        await page.waitForTimeout(1000);
      }
    }

    await page.waitForTimeout(3000);
    emit(`[browser-log] [${elapsed()}] Done!`);
    await context.close();

    return { success: true, cell: cellsLabel };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    emit(`[browser-log] [${elapsed()}] Error: ${message}`);
    if (context) {
      try { await context.close(); } catch { /* ignore */ }
    }
    return { success: false, cell: cellsLabel, error: message };
  }
}
```

- [ ] **Step 5: Update `writeTicketViaPlaywright` to accept `onLog` and create `emit`**

```typescript
export async function writeTicketViaPlaywright(
  ticket: string,
  dates?: Date[],
  onLog?: (line: string) => void
): Promise<{ success: boolean; cell: string; error?: string; logs: string[] }> {
  const effectiveDates = dates && dates.length > 0 ? dates : [new Date()];
  const logs: string[] = [];
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

  const emit = (line: string) => {
    logs.push(line);
    onLog?.(line);
  };

  const cellAddresses = effectiveDates.map((d) => getCellForDate(d, emit));

  emit(`[browser-log] Target cells: ${cellAddresses.join(", ")}, ticket: ${ticket}`);

  const errors: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      emit(`[browser-log] Retry attempt ${attempt}/${MAX_ATTEMPTS}`);
    }

    const result = await attemptWrite(ticket, cellAddresses, elapsed, emit);
    if (result.success) return { ...result, logs };

    const msg = result.error ?? "Unknown error";
    errors.push(`Attempt ${attempt}: ${msg}`);
    emit(`[browser-log] Attempt ${attempt} failed: ${msg}`);
  }

  return { success: false, cell: cellAddresses.join(", "), error: errors.join(" | "), logs };
}
```

- [ ] **Step 6: Verify TypeScript build passes**

```bash
npm run build 2>&1 | grep -E "error|warning|✓"
```

Expected: Build succeeds. No new TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add lib/browser-log.ts
git commit -m "feat: add onLog callback to writeTicketViaPlaywright for live log streaming"
```

---

## Task 5: Add `onLog` Callback to `lib/browser-hrm.ts`

**Files:**
- Modify: `lib/browser-hrm.ts`

Same pattern as Task 4: replace `logs: string[]` with `emit: (line: string) => void` in internal helpers; add `onLog?` to the exported function.

- [ ] **Step 1: Update `findTodayAddButton` signature and body**

```typescript
async function findTodayAddButton(page: Page, todayStr: string, emit: (line: string) => void): Promise<boolean> {
  const selector = `div.tw-w-\\[20\\%\\]:has-text("${todayStr}") button.ant-btn`;
  try {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 3000 })) {
      await btn.click();
      emit(`[hrm-log] Clicked "+ Thêm task" for ${todayStr}`);
      return true;
    }
  } catch {
    emit(`[hrm-log] Primary selector failed for ${todayStr}`);
  }

  emit("[hrm-log] Trying JS fallback to find button...");
  const clicked = await page.evaluate((today) => {
    const headers = document.querySelectorAll("div[class*='tw-bg']");
    for (const header of headers) {
      if (header.textContent?.includes(today)) {
        const btn = header.querySelector("button");
        if (btn) {
          btn.click();
          return true;
        }
      }
    }
    return false;
  }, todayStr);

  if (clicked) {
    emit(`[hrm-log] Clicked "+ Thêm task" via JS fallback`);
    return true;
  }

  emit(`[hrm-log] Could not find "+ Thêm task" for ${todayStr}`);
  return false;
}
```

- [ ] **Step 2: Update `fillTaskPopup` signature and body**

```typescript
async function fillTaskPopup(
  page: Page,
  ticket: string,
  timeSlots: TimeSlot[],
  emit: (line: string) => void
): Promise<void> {
  await waitForAngular(page, 1500);

  emit("[hrm-log] Selecting TSC Project...");

  let dropdownSelected = false;

  const opened = await page.evaluate(() => {
    const modal = document.querySelector("nz-modal-container, .ant-modal, .cdk-overlay-container");
    const root = modal || document;
    const selectors = root.querySelectorAll("nz-select .ant-select-selector, .ant-select-selector, nz-select");
    for (const el of selectors) {
      if (el instanceof HTMLElement) {
        el.click();
        return el.tagName + "." + (el.className || "").toString().slice(0, 50);
      }
    }
    return null;
  });

  if (opened) {
    emit(`[hrm-log] Opened dropdown via JS: ${opened}`);
    await waitForAngular(page, 800);

    const optionSelectors = [
      "nz-option-item:has-text('TSC Project')",
      ".ant-select-item-option:has-text('TSC Project')",
      ".ant-select-item:has-text('TSC Project')",
      ".cdk-overlay-container :text('TSC Project')",
      "text=TSC Project",
    ];

    for (const optSel of optionSelectors) {
      try {
        const option = page.locator(optSel).first();
        if (await option.isVisible({ timeout: 2000 })) {
          await option.click();
          emit(`[hrm-log] Selected TSC Project via: ${optSel}`);
          dropdownSelected = true;
          break;
        }
      } catch {
        continue;
      }
    }
  }

  if (!dropdownSelected) {
    emit("[hrm-log] WARNING: Could not select TSC Project");
  }
  await waitForAngular(page, 500);

  emit(`[hrm-log] Filling Task ID: ${ticket}`);
  const taskIdSelectors = [
    "input[placeholder*='Task']",
    "input[formcontrolname*='task']",
    "input[formcontrolname*='taskId']",
    "xpath=//label[contains(text(),'Task ID')]/following::input[1]",
  ];

  for (const selector of taskIdSelectors) {
    try {
      const input = page.locator(selector).first();
      if (await input.isVisible({ timeout: 1500 })) {
        await input.click();
        await input.fill(ticket);
        emit(`[hrm-log] Filled Task ID via: ${selector}`);
        await page.keyboard.press("Tab");
        break;
      }
    } catch {
      continue;
    }
  }

  emit("[hrm-log] Waiting for task details to load...");
  await waitForAngular(page, 3000);

  const mainIssueType = await page.evaluate(() => {
    const modal = document.querySelector("nz-modal-container, .ant-modal-wrap, .cdk-overlay-container");
    if (!modal) return "";
    const input = modal.querySelector("input[formcontrolname='issueType']") as HTMLInputElement;
    return input?.value || "";
  });
  emit(`[hrm-log] Main issue type: "${mainIssueType}"`);

  for (let i = 0; i < timeSlots.length; i++) {
    const slot = timeSlots[i];
    emit(`[hrm-log] Adding time slot ${i + 1}: ${slot.start} - ${slot.end}`);

    const plusClicked = await page.evaluate(() => {
      const modal = document.querySelector("nz-modal-container, .ant-modal-wrap, .cdk-overlay-container");
      if (!modal) return false;
      const btn = modal.querySelector("button.ant-btn-icon-only:not([disabled])") as HTMLButtonElement;
      if (btn) { btn.click(); return true; }
      return false;
    });
    emit(`[hrm-log] + button clicked: ${plusClicked}`);
    await waitForAngular(page, 1000);

    const timeInputs = page.locator("input[placeholder='hh:mm']");
    const timeCount = await timeInputs.count();
    emit(`[hrm-log] Found ${timeCount} time inputs`);

    if (timeCount >= 2) {
      const startInput = timeInputs.nth(timeCount - 2);
      const endInput = timeInputs.nth(timeCount - 1);

      await startInput.click();
      await startInput.fill(slot.start);
      await page.keyboard.press("Tab");
      await waitForAngular(page, 300);

      await endInput.click();
      await endInput.fill(slot.end);
      await page.keyboard.press("Tab");
      await waitForAngular(page, 500);

      emit(`[hrm-log] Filled time: ${slot.start} - ${slot.end}`);
    }

    if (mainIssueType) {
      const filled = await page.evaluate((issueType) => {
        const modal = document.querySelector("nz-modal-container, .ant-modal-wrap, .cdk-overlay-container");
        if (!modal) return "no modal";
        const inputs = modal.querySelectorAll("input[placeholder='Loại task']") as NodeListOf<HTMLInputElement>;
        for (let j = inputs.length - 1; j >= 0; j--) {
          const input = inputs[j];
          if (input.getAttribute("formcontrolname") === "issueType") continue;
          if (!input.value) {
            input.focus();
            input.click();
            return `focused index ${j}`;
          }
        }
        return "no empty input";
      }, mainIssueType);
      emit(`[hrm-log] Loại task focus: ${filled}`);
      await waitForAngular(page, 300);

      const lastLoaiTask = page.locator("input[placeholder='Loại task']").last();
      await lastLoaiTask.fill(mainIssueType);
      await waitForAngular(page, 800);

      const optionClicked = await page.evaluate((value) => {
        const overlay = document.querySelector(".cdk-overlay-container");
        if (!overlay) return "no overlay";
        const options = overlay.querySelectorAll("nz-auto-option, .ant-select-item-option, [nz-option-item], mat-option");
        for (const opt of options) {
          if (opt.textContent?.trim().includes(value) && opt instanceof HTMLElement) {
            opt.click();
            return `selected: "${opt.textContent.trim()}"`;
          }
        }
        for (const opt of options) {
          if (opt instanceof HTMLElement) {
            opt.click();
            return `selected fallback: "${opt.textContent?.trim()}"`;
          }
        }
        return "no option found";
      }, mainIssueType);
      emit(`[hrm-log] Loại task autocomplete: ${optionClicked}`);

      if (optionClicked === "no option found") {
        await page.keyboard.press("Enter");
        emit("[hrm-log] Pressed Enter to confirm Loại task");
      }

      await waitForAngular(page, 500);
    }
  }

  emit("[hrm-log] Clicking Lưu...");
  await waitForAngular(page, 500);

  const saveResult = await page.evaluate(() => {
    const modal = document.querySelector("nz-modal-container, .ant-modal-wrap, .cdk-overlay-container");
    if (!modal) return "no modal";
    const saveBtn = modal.querySelector("button.btn-save-and-close") as HTMLButtonElement;
    if (saveBtn && !saveBtn.disabled) {
      saveBtn.click();
      return "clicked Lưu";
    }
    if (saveBtn) return `Lưu is disabled`;
    return "Lưu button not found";
  });
  emit(`[hrm-log] Save result: ${saveResult}`);

  await waitForAngular(page, 2000);
}
```

- [ ] **Step 3: Update `logTicketsToHrm` to accept `onLog` and create `emit`**

```typescript
export async function logTicketsToHrm(
  tickets: string[],
  date?: Date,
  onLog?: (line: string) => void
): Promise<{ success: boolean; error?: string; logs: string[] }> {
  const todayStr = getDateString(date ?? new Date());
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
  const logs: string[] = [];

  const emit = (line: string) => {
    logs.push(line);
    onLog?.(line);
  };

  emit(`[hrm-log] Tickets: ${tickets.join(", ")}, Date: ${todayStr}`);

  let context: BrowserContext | null = null;

  try {
    context = await chromium.launchPersistentContext(HRM_PROFILE_DIR, {
      channel: "msedge",
      headless: false,
      args: ["--disable-blink-features=AutomationControlled"],
      viewport: { width: 1400, height: 900 },
    });
    emit(`[hrm-log] [${elapsed()}] Browser launched`);

    const page = context.pages()[0] || (await context.newPage());

    await page.goto(HRM_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    emit(`[hrm-log] [${elapsed()}] Page loaded`);

    try {
      await page.waitForSelector("text=Timesheet", { timeout: 15000 });
      emit(`[hrm-log] [${elapsed()}] Timesheet visible`);
    } catch {
      emit(`[hrm-log] [${elapsed()}] Timesheet text not found, continuing...`);
    }
    await waitForAngular(page, 1000);

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const slots = getTimeSlots(tickets.length, i);
      emit(`[hrm-log] [${elapsed()}] Processing ticket ${i + 1}/${tickets.length}: ${ticket}`);

      const found = await findTodayAddButton(page, todayStr, emit);
      if (!found) {
        await context.close();
        return { success: false, error: `Could not find today's date (${todayStr}) or "+ Thêm task" button.`, logs };
      }

      await fillTaskPopup(page, ticket, slots, emit);
      emit(`[hrm-log] [${elapsed()}] Ticket ${ticket} saved`);
    }

    emit(`[hrm-log] [${elapsed()}] Done!`);
    await context.close();

    return { success: true, logs };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    emit(`[hrm-log] [${elapsed()}] Error: ${message}`);
    if (context) {
      try { await context.close(); } catch { /* ignore */ }
    }
    return { success: false, error: message, logs };
  }
}
```

- [ ] **Step 4: Verify TypeScript build passes**

```bash
npm run build 2>&1 | grep -E "error TS|✓ Generating"
```

Expected: No TypeScript errors. Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add lib/browser-hrm.ts
git commit -m "feat: add onLog callback to logTicketsToHrm for live log streaming"
```

---

## Task 6: Update API Routes to Stream NDJSON

**Files:**
- Modify: `app/api/sharepoint/log/route.ts`
- Modify: `app/api/hrm/log/route.ts`

- [ ] **Step 1: Replace `app/api/sharepoint/log/route.ts` entirely**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { writeTicketViaPlaywright } from "@/lib/browser-log";
import type { LogRequestBody, LogStreamLine } from "@/lib/types";

const TICKET_PATTERN = /^MDP-\d+(,\s*MDP-\d+)*$/;

export async function POST(request: NextRequest): Promise<Response> {
  let body: LogRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { ticket, dates } = body;

  if (!ticket || !TICKET_PATTERN.test(ticket)) {
    return NextResponse.json(
      { success: false, error: "Invalid ticket format. Expected MDP-XXXX." },
      { status: 400 }
    );
  }

  const dateObjs =
    dates && dates.length > 0
      ? dates.map((d) => new Date(`${d}T00:00:00`))
      : undefined;

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  const writeLine = (obj: LogStreamLine) => {
    writer.write(encoder.encode(JSON.stringify(obj) + "\n"));
  };

  (async () => {
    try {
      const result = await writeTicketViaPlaywright(ticket, dateObjs, (line) => {
        writeLine({ type: "log", data: line });
      });
      writeLine(
        result.success
          ? { type: "result", success: true, cell: result.cell }
          : { type: "result", success: false, cell: result.cell, error: result.error ?? "Unknown error" }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      writeLine({ type: "result", success: false, error: message });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
```

- [ ] **Step 2: Replace `app/api/hrm/log/route.ts` entirely**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { logTicketsToHrm } from "@/lib/browser-hrm";
import type { HrmLogRequestBody, HrmStreamLine } from "@/lib/types";

const TICKET_PATTERN = /^MDP-\d+$/;

export async function POST(request: NextRequest): Promise<Response> {
  let body: HrmLogRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { tickets, dates } = body;

  if (!Array.isArray(tickets) || tickets.length === 0 || tickets.length > 5) {
    return NextResponse.json(
      { success: false, error: "Expected 1 to 5 tickets." },
      { status: 400 }
    );
  }

  for (const ticket of tickets) {
    if (!TICKET_PATTERN.test(ticket)) {
      return NextResponse.json(
        { success: false, error: `Invalid ticket format: ${ticket}. Expected MDP-XXXX.` },
        { status: 400 }
      );
    }
  }

  const dateObjs =
    dates && dates.length > 0
      ? dates.map((d) => new Date(`${d}T00:00:00`))
      : [undefined];

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  const writeLine = (obj: HrmStreamLine) => {
    writer.write(encoder.encode(JSON.stringify(obj) + "\n"));
  };

  (async () => {
    try {
      for (const dateObj of dateObjs) {
        const result = await logTicketsToHrm(tickets, dateObj, (line) => {
          writeLine({ type: "log", data: line });
        });
        if (!result.success) {
          writeLine({ type: "result", success: false, error: result.error ?? "Unknown error" });
          return;
        }
      }
      writeLine({ type: "result", success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      writeLine({ type: "result", success: false, error: message });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build 2>&1 | grep -E "error TS|✓ Generating|Warning"
```

Expected: Build succeeds. The existing unused-var warning in `browser-hrm.ts` is acceptable.

- [ ] **Step 4: Run all tests one final time**

```bash
npx jest __tests__/LogForm.test.tsx 2>&1 | tail -10
```

Expected:
```
Tests: 63 passed, 63 total
```

- [ ] **Step 5: Commit**

```bash
git add app/api/sharepoint/log/route.ts app/api/hrm/log/route.ts
git commit -m "feat: stream NDJSON logs from sharepoint and HRM API routes"
```
