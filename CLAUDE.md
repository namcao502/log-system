# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TSC Daily Log System** — A personal productivity tool that automates logging Jira tickets (MDP-xxxx) to two destinations: a shared SharePoint Excel file ("TSC Development WIP.xlsx") and an HRM timesheet. Built for a single user (Nam Nguyen) at TSC/New Ocean Infosys.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict mode, no `any`)
- **Styling:** Tailwind CSS
- **Testing:** Jest + React Testing Library
- **Browser Automation:** Playwright (Edge) — writes to Excel Online and HRM via browser
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
  page.tsx              # Server component — welcome header, Vietnamese date, renders LogForm
  layout.tsx            # Root layout with Inter font
  globals.css           # Tailwind directives + slide-in animation
  api/
    jira/
      verify/route.ts   # GET /api/jira/verify?ticket=MDP-xxxx — validates ticket exists
    sharepoint/
      log/route.ts      # POST /api/sharepoint/log — Playwright writes to Excel Online
    hrm/
      log/route.ts      # POST /api/hrm/log — Playwright writes to HRM timesheet
lib/
  types.ts              # Shared interfaces for all API request/response shapes
  jira.ts               # Jira REST API client (Basic auth, API token from env)
  browser-log.ts        # Playwright: opens Excel Online, navigates to cell, types ticket
  browser-hrm.ts        # Playwright: opens HRM timesheet, logs tickets per date
components/
  LogForm.tsx           # Main client component — all state and log orchestration
  StatusIndicator.tsx   # Colored dot/spinner/check/cross for async operation state
  DatePickerPopover.tsx # Calendar popover built on react-day-picker; hides a real <input type="date"> for test/a11y
__tests__/
  LogForm.test.tsx
  StatusIndicator.test.tsx
  jira.test.ts
```

### Data Flow

1. User types `MDP-xxxx` (comma-separated for multiple) and clicks **Verify**
2. Frontend calls `/api/jira/verify` for each ticket in parallel
3. Valid tickets are auto-staged (up to 5) in `stagedTickets`
4. User selects one or more dates via `DatePickerPopover` + "+ Add"
5. User clicks one of three actions:
   - **Log TSC** — `POST /api/sharepoint/log` with `{ ticket, dates }`
   - **Log HRM** — `POST /api/hrm/log` with `{ tickets, dates }`
   - **Log All** — both requests fired in parallel via `Promise.all`
6. On success, `stagedTickets` is cleared and status fades out after 10 s

### Excel File Details

- **File:** TSC Development WIP.xlsx (Dave Markert's OneDrive)
- **Worksheet:** "Daily Reports - 2026"
- **Column B:** Dates in M/D/YYYY format
- **Column O:** "Nam Nguyen" — target column for logging
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

### Playwright Browser Profile

Persistent session stored at `~/.tsc-daily-log-browser/`. First run requires manual Microsoft login. Subsequent runs reuse saved cookies.

## Conventions

- API routes handle all external service calls — the frontend never calls Jira or HRM directly
- Shared request/response types live in `lib/types.ts` — imported by both API routes and components
- Async operation state in `LogForm` uses a discriminated union: `idle | loading | success | error`
- Jira status auto-clears after 20 s; TSC/HRM log status auto-clears after 10 s (with a 500 ms fade)
- `DatePickerPopover` wraps a hidden `<input type="date">` (for tests and screen readers) alongside a styled calendar popover
- Ticket format: `MDP-\d+`, comma-separated for multi-ticket input; max 5 staged tickets
- Dates are stored as `YYYY-MM-DD` strings; formatted for display with `Intl.DateTimeFormat`
