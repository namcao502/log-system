# TSC Daily Log System

A personal productivity tool that automates logging Jira tickets (MDP-xxxx) to a shared SharePoint Excel file and an HRM timesheet.

## What It Does

1. Enter one or more Jira ticket IDs (e.g. `MDP-1234, MDP-5678`)
2. Verify they exist in Jira
3. Select one or more dates
4. Log to SharePoint Excel, HRM, or both in one click

## Tech Stack

- **Next.js 15** (App Router) + TypeScript (strict)
- **Tailwind CSS**
- **Playwright** (Edge) for browser automation
- **Jest** + React Testing Library

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file:

```env
JIRA_BASE_URL=https://newoceaninfosys.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-atlassian-api-token
```

### 3. Authenticate browser sessions (first run only)

The app uses Playwright with a persistent browser profile at `~/.tsc-daily-log-browser/`. On first run, it will open a browser window for you to log in to Microsoft (SharePoint) and HRM manually. Subsequent runs reuse saved cookies.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
npm test         # Run all tests
```

## Architecture

```
app/
  page.tsx                    # Server component - renders LogForm
  api/
    jira/verify/route.ts      # GET  /api/jira/verify?ticket=MDP-xxxx
    sharepoint/log/route.ts   # POST /api/sharepoint/log
    hrm/log/route.ts          # POST /api/hrm/log
lib/
  types.ts                    # Shared request/response types
  jira.ts                     # Jira REST API client
  browser-log.ts              # Playwright: writes to Excel Online
  browser-hrm.ts              # Playwright: writes to HRM timesheet
components/
  LogForm.tsx                 # Main client component
  StatusIndicator.tsx         # Async state indicator (idle/loading/success/error)
  DatePickerPopover.tsx       # Calendar popover (react-day-picker)
__tests__/
  LogForm.test.tsx
  StatusIndicator.test.tsx
  jira.test.ts
```

## Excel File Details

- **File:** TSC Development WIP.xlsx (Dave Markert's OneDrive)
- **Sheet:** Daily Reports - 2026
- **Column B:** Dates (M/D/YYYY)
- **Column O:** Nam Nguyen's log column
- **Row formula:** `row = 2 + dayOfYear`
- Multiple tickets are appended with `, ` separator

## Notes

- Max 5 staged tickets at a time
- Ticket format: `MDP-\d+`
- Dates stored as `YYYY-MM-DD`, displayed via `Intl.DateTimeFormat`
- Timezone: Asia/Ho_Chi_Minh
- Jira verify status clears after 20 s; log status clears after 10 s
