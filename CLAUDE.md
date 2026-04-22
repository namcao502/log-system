# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TSC Daily Log System** — A personal productivity tool that automates logging Jira tickets (MDP-xxxx) to two destinations: a shared SharePoint Excel file ("TSC Development WIP.xlsx") and an HRM timesheet. Built for a single user (Nam Nguyen) at TSC/New Ocean Infosys.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict mode, no `any`)
- **Styling:** Tailwind CSS
- **Testing:** Jest + React Testing Library
- **Browser Automation:** Playwright (Chrome) — writes to Excel Online and HRM via browser
- **Date Picker:** `react-day-picker`
- **External APIs:** Jira Cloud REST API

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run all tests
npx jest <file>      # Run a single test file
```

## Architecture

```
app/
  page.tsx              # Server component — renders AppShell with Vietnamese date
  layout.tsx            # Root layout with Inter font
  globals.css           # Tailwind directives, autofill override, scrollbar utility
  api/
    jira/
      verify/route.ts   # GET /api/jira/verify?ticket=MDP-xxxx — validates ticket exists
    sharepoint/
      log/route.ts      # POST /api/sharepoint/log — streams NDJSON; Playwright writes to Excel Online
    hrm/
      log/route.ts      # POST /api/hrm/log — streams NDJSON; Playwright writes to HRM timesheet
lib/
  types.ts              # Shared interfaces: JiraVerifyResponse, LogRequestBody, HrmLogRequestBody,
                        #   LogStreamLine, HrmStreamLine, Notification, Toast (discriminated unions)
  constants.ts          # All UI plain-text strings: LABELS (display text) and NOTIFY (notification messages)
  jira.ts               # Jira REST API client (Basic auth, API token from env)
  browser-tsc.ts        # Playwright: opens Excel Online, navigates to cell, types ticket; accepts onLog callback
  browser-hrm.ts        # Playwright: opens HRM timesheet, logs tickets per date; accepts onLog callback
  time-slots.ts         # Divides the 9:00-18:00 workday (lunch break excluded) evenly across N tickets;
                        #   returns TimeSlot[] with HH:MM start/end for each ticket
  useNotifications.ts   # Hook: notification list state with addNotification, markRead, clearAll
  useToasts.ts          # Hook: transient toast list state with addToast, dismissToast
components/
  AppShell.tsx          # Client shell — wires useNotifications + useToasts, renders header + LogForm
  LogForm.tsx           # Main client component — all state, log orchestration, readNdJsonStream helper
  LogPanel.tsx          # Scrollable dark-terminal pre block for streaming log lines
  DatePickerPopover.tsx # Calendar popover built on react-day-picker; hides a real <input type="date"> for test/a11y
  NotificationBell.tsx  # Bell icon with unread badge; dropdown list of past notifications
  Toast.tsx             # Single auto-dismissing toast item (4 s)
  ToastContainer.tsx    # Fixed top-right stack of active toasts
__tests__/
  LogForm.test.tsx
  LogPanel.test.tsx
  NotificationBell.test.tsx
  Toast.test.tsx
  useNotifications.test.ts
  useToasts.test.ts
  browser-hrm.test.ts
  jira.test.ts
```

### Data Flow

1. User types `MDP-xxxx` (comma-separated for multiple) and clicks **Verify**
2. Frontend calls `/api/jira/verify` for each ticket in parallel
3. Valid tickets are auto-staged (up to 5) in `stagedTickets`
4. User selects one or more dates via `DatePickerPopover` + **Add** (up to 5 dates)
5. User clicks one of three actions:
   - **Log TSC** — `POST /api/sharepoint/log` with `{ ticket, dates }`
   - **Log HRM** — `POST /api/hrm/log` with `{ tickets, dates }`
   - **Log All** — both requests fired in parallel via `Promise.all`
6. Each API route responds immediately with `Content-Type: application/x-ndjson` and streams progress
   - `{ type: "log", data: string }` lines are appended live to the log panel in the UI
   - A final `{ type: "result", success: bool, ... }` line signals completion
   - `readNdJsonStream()` in `LogForm.tsx` drives the consumer loop
7. On success, `stagedTickets` is cleared; a toast notification and a bell notification are both fired

### Excel File Details

- **File:** TSC Development WIP.xlsx (Dave Markert's OneDrive)
- **Worksheet:** "Daily Reports - 2026"
- **Column B:** Dates in M/D/YYYY format
- **Column M:** Target column for logging (constant `TARGET_COLUMN` in `browser-tsc.ts`)
- **Row formula:** row = 2 (header rows) + dayOfYear
- **Multiple tickets:** Appended with `, ` separator
- **Timezone:** Asia/Ho_Chi_Minh

### External Services

| Service | Auth method |
|---------|-------------|
| Jira Cloud (`https://newoceaninfosys.atlassian.net`) | Basic auth (email + API token) |
| SharePoint Excel (Dave Markert's OneDrive) | Playwright saved browser session |
| HRM timesheet | Playwright saved browser session |

### Environment Variables

```
JIRA_BASE_URL=https://newoceaninfosys.atlassian.net
JIRA_EMAIL=<atlassian account email>
JIRA_API_TOKEN=<atlassian API token>
```

### Playwright Browser Profiles

Two separate persistent sessions — each requires a manual login on first run:

| Profile dir | Used for |
|-------------|----------|
| `~/.tsc-daily-log-browser/` | SharePoint Excel (Microsoft login) |
| `~/.tsc-daily-log-hrm-browser/` | HRM timesheet (hrm.nois.vn login) |

## Conventions

- API routes handle all external service calls — the frontend never calls Jira or HRM directly
- Shared request/response types live in `lib/types.ts` — imported by both API routes and components
- All UI plain-text strings live in `lib/constants.ts` (`LABELS` for display, `NOTIFY` for notifications) — never hardcode strings in components
- Async operation state in `LogForm` uses three separate boolean flags: `isJiraLoading`, `isTscLogging`, `isHrmLogging`
- `DatePickerPopover` wraps a hidden `<input type="date">` (for tests and screen readers) alongside a styled calendar popover
- Ticket format: `MDP-\d+`, comma-separated for multi-ticket input; max 5 staged tickets
- Dates are stored as `YYYY-MM-DD` strings; formatted for display with `Intl.DateTimeFormat`
- Max 5 staged dates; both tickets and dates show a **Clear All** button when non-empty

### UI Theme

Teal/emerald gradient palette throughout:

| Element | Classes |
|---------|---------|
| Page background | `bg-gradient-to-br from-emerald-100 to-teal-100` |
| Cards / popovers | `bg-gradient-to-br from-emerald-50 to-teal-50`, `border-emerald-200` |
| Card section labels | `text-emerald-700` (uppercase, tracking-widest) |
| Form labels | `text-emerald-800` |
| White inputs / list items | `bg-white border-emerald-200`, focus `ring-emerald-500` |
| Primary buttons (Verify, Add) | `bg-emerald-600 hover:bg-emerald-500` |
| Log All button | `bg-emerald-800 hover:bg-emerald-700` |
| Will-log summary block | `bg-emerald-50 border-l-emerald-500` |
| Log panel (terminal) | `bg-[#022c22]`, prefix `text-emerald-400` |
| Notifications: info | `text-teal-600` / `bg-teal-50` |
| Error / success states | red / green — unchanged |

### NDJSON Streaming

Both logging API routes stream progress as newline-delimited JSON (`application/x-ndjson`):

```
{ "type": "log",    "data": "[browser-tsc] Browser launched" }
{ "type": "log",    "data": "[browser-tsc] Navigated to M366" }
{ "type": "result", "success": true, "cell": "M366" }
```

- `browser-tsc.ts` and `browser-hrm.ts` accept `onLog?: (line: string) => void` — called for each progress line
- API routes write each line to a `TransformStream` as it arrives and close the stream on completion
- `readNdJsonStream(body, onLog)` in `LogForm.tsx` reads the stream, dispatches `log` lines to the UI, and returns the final `result` object
- `LogStreamLine` / `HrmStreamLine` in `lib/types.ts` are the typed discriminated unions for each line shape
