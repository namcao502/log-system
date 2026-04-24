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
  globals.css           # Tailwind directives, MD3 color tokens, surface/button utilities, corner SVG animation CSS
  api/
    jira/
      verify/route.ts   # GET /api/jira/verify?ticket=MDP-xxxx — validates ticket exists
    sharepoint/
      log/route.ts      # POST /api/sharepoint/log — streams NDJSON; Playwright writes to Excel Online
    hrm/
      log/route.ts      # POST /api/hrm/log — streams NDJSON; Playwright writes to HRM timesheet
lib/
  types.ts              # Shared interfaces: JiraVerifyResponse, LogRequestBody, HrmLogRequestBody,
                        #   LogStreamLine, HrmStreamLine, Notification, Toast (discriminated unions), LogRow
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
  LogForm.tsx           # Main client component — rows: LogRow[] state, groupByDate, log orchestration, readNdJsonStream helper
  LogRowItem.tsx        # Single log entry row — DatePickerPopover + ticket input + StatusBadge + remove button
  LogPanel.tsx          # Scrollable dark-terminal pre block for streaming log lines
  DatePickerPopover.tsx # Calendar popover built on react-day-picker; hides a real <input type="date"> for test/a11y; min popover width 280px
  NotificationBell.tsx  # Bell icon with unread badge; dropdown list of past notifications
  Toast.tsx             # Single auto-dismissing toast item (4 s)
  ToastContainer.tsx    # Fixed top-right stack of active toasts
__tests__/
  LogForm.test.tsx
  LogRowItem.test.tsx
  LogPanel.test.tsx
  NotificationBell.test.tsx
  Toast.test.tsx
  useNotifications.test.ts
  useToasts.test.ts
  browser-hrm.test.ts
  jira.test.ts
```

### Data Flow

1. User starts with one empty row (date = today, ticket = blank)
2. User types a ticket number (e.g. `1234`) — auto-prefixed to `MDP-1234` on each keystroke
3. On blur, `handleTicketBlur` calls `GET /api/jira/verify?ticket=MDP-1234`; row status becomes `valid` (green check) or `invalid` (red X)
4. User clicks **+ Add row** to log more (date, ticket) pairs; each row is independent
5. `groupByDate(rows)` groups all valid rows by date — same-date rows are combined into one API call
6. User clicks one of three actions:
   - **Log TSC** — iterates date groups, `POST /api/sharepoint/log` with `{ ticket: joined, dates: [date] }` per group
   - **Log HRM** — iterates date groups, `POST /api/hrm/log` with `{ tickets, dates: [date] }` per group
   - **Log All** — TSC and HRM iterations run in parallel via `Promise.all`
7. Each API route responds with `Content-Type: application/x-ndjson` and streams progress
   - `{ type: "log", data: string }` lines are appended live to the log panel in the UI
   - A final `{ type: "result", success: bool, ... }` line signals completion
   - `readNdJsonStream()` in `LogForm.tsx` drives the consumer loop
8. On success, rows are reset to one empty row; a toast notification and a bell notification are fired

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
- Async operation state in `LogForm` uses two boolean flags: `isTscLogging`, `isHrmLogging`
- `LogForm` state is `rows: LogRow[]` — one entry per (date, ticket) pair; grouping by date happens at log time via `groupByDate()`
- `LogRowItem` handles auto-prefix: bare digits become `MDP-{digits}`; Jira verification fires on blur
- `DatePickerPopover` wraps a hidden `<input type="date">` (for tests and screen readers) alongside a styled calendar popover; popover min-width is `Math.max(triggerWidth, 280)`
- Ticket format: `MDP-\d+`; auto-prefixed in `LogRowItem.handleTicketChange`
- Dates are stored as `YYYY-MM-DD` strings; formatted for display with `Intl.DateTimeFormat`

### UI Theme

Material You (MD3) dark scheme. All color tokens are derived from `--theme-hue` so `ThemePicker` and rainbow mode drive the entire palette without touching component code.

**CSS custom properties (`globals.css`)**

| Token | Role |
|-------|------|
| `--md-primary` | Accent color — filled buttons, focus rings, corner ripple stroke |
| `--md-primary-container` | Log All button background |
| `--md-on-primary-container` | Log All button text |
| `--md-secondary-container` | Tonal button (Log TSC / Log HRM) background |
| `--md-on-secondary-container` | Tonal button text |
| `--md-background` / `--md-surface` | Page and base surface color (hue, 15%, 11%) |
| `--md-surface-container` | Card / popover background |
| `--md-surface-container-high` | Nested container background (status panels) |
| `--md-surface-container-highest` | List item rows |
| `--md-on-surface` | Primary text |
| `--md-on-surface-variant` | Secondary text, section labels, icon buttons |
| `--md-outline-variant` | Card borders, dividers |
| `--md-outline` | Input borders |

**CSS utility classes**

| Class | Applied to |
|-------|-----------|
| `md-surface` | Cards, popover panels (`rounded-2xl`) |
| `md-surface-high` | Nested status log containers (`rounded-xl`) |
| `md-list-item` | Ticket and date list rows |
| `md-input` | Text inputs and date picker trigger |
| `md-btn-filled` | Verify, Add buttons (pill shape) |
| `md-btn-tonal` | Log TSC, Log HRM buttons (pill shape) |
| `md-btn-accent` | Log All button — elevated with shadow |

**Corner decorations (`page.tsx`)**

Four 1x1 px fixed SVG anchors at screen corners, each with 3 unique polygon outlines that scale from near-zero and fade over 6 s (2 s stagger). Shapes are outlined (fill: none), colored with hue offsets +0/+28/+56 from `--md-primary`. Each corner has a distinct shape family:

| Corner | Family | Shapes |
|--------|--------|--------|
| TL | Sharp / triangular | right triangle, thin spike, skewed triangle |
| TR | Concave / notched | boomerang, arrowhead notch, wide flat triangle |
| BL | Stepped / architectural | L-shape, Z-step, double staircase |
| BR | Organic / asymmetric | skewed quad, asymmetric pentagon, diamond |

TR/BL/BR reuse the same shape definitions mirrored via SVG `transform="scale(-1,1)"` etc. so shapes always point inward from their corner.

### NDJSON Streaming

Both logging API routes stream progress as newline-delimited JSON (`application/x-ndjson`):

```
{ "type": "log",    "data": "[tsc-log] Browser launched" }
{ "type": "log",    "data": "[tsc-log] Navigated to M366" }
{ "type": "result", "success": true, "cell": "M366" }
```

- `browser-tsc.ts` and `browser-hrm.ts` accept `onLog?: (line: string) => void` — called for each progress line
- API routes write each line to a `TransformStream` as it arrives and close the stream on completion
- `readNdJsonStream(body, onLog)` in `LogForm.tsx` reads the stream, dispatches `log` lines to the UI, and returns the final `result` object
- `LogStreamLine` / `HrmStreamLine` in `lib/types.ts` are the typed discriminated unions for each line shape
