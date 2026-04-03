# Live Log Streaming Design

**Date:** 2026-04-03
**Status:** Approved

## Problem

Logs from Playwright browser operations (TSC SharePoint write, HRM timesheet log) are only visible after the full operation completes. Operations take 30-90 seconds. Users have no feedback during that time beyond a spinner.

## Goal

Stream log lines to the UI in real time, one line at a time, as Playwright emits them. TSC and HRM operations each stream independently to their own log row.

## Approach: NDJSON Streaming via ReadableStream

API routes return a `Response` with a `ReadableStream` body. Each line is a JSON object followed by `\n`. The frontend reads the stream incrementally and appends log lines as they arrive.

Two line types:

```
{ "type": "log",    "data": "[browser-log] Browser launched"  }
{ "type": "result", "success": true, "cell": "M100"           }
{ "type": "result", "success": false, "error": "Nav failed"   }
```

Content-Type: `application/x-ndjson`

## Architecture

### 1. Browser scripts (`lib/browser-log.ts`, `lib/browser-hrm.ts`)

Add `onLog?: (line: string) => void` parameter to the two exported functions:

- `writeTicketViaPlaywright(ticket, dates?, onLog?)`
- `logTicketsToHrm(tickets, date?, onLog?)`

Internally create an `emit` function:

```typescript
const emit = (line: string) => {
  logs.push(line);
  onLog?.(line);
};
```

Replace all `logs.push(line)` calls with `emit(line)`. Change all internal helper function signatures from `logs: string[]` to `emit: (line: string) => void`. Return shape is unchanged — `logs` array still returned for test compatibility.

### 2. API routes

**`app/api/sharepoint/log/route.ts`**

Return type changes from `NextResponse<LogResponse>` to `Response`.

- Validation errors (400) still use `NextResponse.json(...)` and return immediately.
- For valid requests: create a `TransformStream`, launch the browser operation in a background async IIFE passing an `onLog` callback that writes `{ type: "log", data }` lines, write `{ type: "result", ...result }` when done, close the writer. Return `new Response(stream.readable, { headers: { "Content-Type": "application/x-ndjson" } })` immediately.

**`app/api/hrm/log/route.ts`**

Same pattern. The date loop (`for dateObj of dateObjs`) runs inside the background IIFE — logs from each date session flow through the same callback into the same stream.

### 3. Frontend (`components/LogForm.tsx`)

Extract a shared helper:

```typescript
async function readNdJsonStream(
  body: ReadableStream<Uint8Array>,
  onLog: (line: string) => void
): Promise<{ success: boolean; cell?: string; error?: string }>
```

- Reads chunks with a `TextDecoder`
- Buffers incomplete lines across chunk boundaries
- Dispatches `type: "log"` lines to `onLog` immediately
- Returns when `type: "result"` line is received

`handleLogTsc` and `handleLogHrm` each call `readNdJsonStream`, passing a setter that appends to `tscLogs` / `hrmLogs` immutably. `handleLogAll` calls both in parallel via `Promise.all`, each with its own `onLog` callback targeting the correct log state.

`setTscLogs` / `setHrmLogs` are reset to `[]` at the start of each operation (existing behavior), then each log line is appended:

```typescript
onLog: (line) => setTscLogs((prev) => [...prev, line])
```

No changes to `StatusIndicator` — it already renders a growing `logs` array with a toggle.

### 4. Types (`lib/types.ts`)

Add streaming message types (used internally by the helper, not exported to API consumers):

```typescript
type LogStreamLine =
  | { type: "log"; data: string }
  | { type: "result"; success: true; cell: string }
  | { type: "result"; success: false; cell?: string; error: string };

type HrmStreamLine =
  | { type: "log"; data: string }
  | { type: "result"; success: true }
  | { type: "result"; success: false; error: string };
```

Existing `LogResponse` and `HrmLogResponse` types are kept for test helpers that still reference them.

### 5. Tests (`__tests__/LogForm.test.tsx`)

Add a `streamResponse(lines)` helper that encodes an array of objects as NDJSON in a `ReadableStream`:

```typescript
function streamResponse(lines: object[], status = 200): Promise<Response>
```

Update all TSC log, HRM log, and Log All test cases to use `streamResponse` instead of `jsonResponse`. Verify tests (`/api/jira/verify`) are unaffected. Log-banner tests updated: logs appear as individual lines during the stream, so assertions check `setTscLogs` is called incrementally (or check final rendered state after stream completes).

## Data Flow

```
User clicks Log TSC
  -> handleLogTsc sets logStatus: loading, tscLogs: []
  -> fetch POST /api/sharepoint/log
     -> route validates, creates TransformStream, returns stream immediately
     -> background IIFE calls writeTicketViaPlaywright(..., onLog)
        -> Playwright emits "[browser-log] Browser launched"
           -> onLog writes {"type":"log","data":"..."}\n to stream
           -> frontend reader appends to tscLogs -> StatusIndicator updates
        -> ... more log lines ...
        -> operation completes
        -> onLog writes {"type":"result","success":true,"cell":"M100"}\n
        -> writer.close()
  -> readNdJsonStream resolves with { success: true, cell: "M100" }
  -> handleLogTsc sets logStatus: success
```

## Error Handling

- Validation errors (bad ticket format, missing dates): 400 JSON response before stream starts — frontend `catch` block handles.
- Browser error mid-stream: caught in the background IIFE, written as `{ type: "result", success: false, error: "..." }`, stream closed cleanly.
- Network error (fetch throws): existing `catch` block in each handler sets status to error.
- Partial chunk: `readNdJsonStream` buffers the incomplete line until the next chunk arrives.

## Out of Scope

- Jira verify endpoint (already fast, stays JSON)
- Persisting logs across page reloads
- Cancelling an in-progress operation
