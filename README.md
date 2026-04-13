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

The app uses two separate Playwright persistent profiles. On first run each will open a browser window for manual login; subsequent runs reuse saved cookies.

| Profile dir | Used for |
|-------------|----------|
| `~/.tsc-daily-log-browser/` | SharePoint Excel (Microsoft login) |
| `~/.tsc-daily-log-hrm-browser/` | HRM timesheet (hrm.nois.vn login) |

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
  page.tsx                    # Server component - renders AppShell with formatted date
  layout.tsx                  # Root layout with Inter font
  globals.css                 # Tailwind directives
  api/
    jira/verify/route.ts      # GET  /api/jira/verify?ticket=MDP-xxxx
    sharepoint/log/route.ts   # POST /api/sharepoint/log
    hrm/log/route.ts          # POST /api/hrm/log
lib/
  types.ts                    # Shared interfaces (discriminated unions for stream lines, notifications, toasts)
  constants.ts                # All UI strings: LABELS (display) and NOTIFY (notifications)
  jira.ts                     # Jira REST API client (Basic auth)
  browser-tsc.ts              # Playwright: writes to SharePoint Excel Online
  browser-hrm.ts              # Playwright: writes to HRM timesheet
  time-slots.ts               # Divides 9:00-18:00 workday evenly across N tickets
  useNotifications.ts         # Hook: persistent notification list (addNotification, markRead, clearAll)
  useToasts.ts                # Hook: transient toast list (addToast, dismissToast)
components/
  AppShell.tsx                # Client shell - wires notifications + toasts, renders header + LogForm
  LogForm.tsx                 # Main client component - all state and log orchestration
  LogPanel.tsx                # Scrollable dark-terminal pre block for streaming log lines
  DatePickerPopover.tsx       # Calendar popover (react-day-picker) with hidden <input type="date">
  NotificationBell.tsx        # Bell icon with unread badge and dropdown
  Toast.tsx                   # Single auto-dismissing toast (4 s)
  ToastContainer.tsx          # Fixed top-right stack of active toasts
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

## Excel File Details

- **File:** TSC Development WIP.xlsx (Dave Markert's OneDrive)
- **Sheet:** Daily Reports - 2026
- **Column B:** Dates (M/D/YYYY)
- **Column M:** Log target column (`TARGET_COLUMN` in `browser-tsc.ts`)
- **Row formula:** `row = 2 + dayOfYear`
- Multiple tickets are appended with `, ` separator

## Notes

- Max 5 staged tickets at a time
- Ticket format: `MDP-\d+`
- Dates stored as `YYYY-MM-DD`, displayed via `Intl.DateTimeFormat`
- Timezone: Asia/Ho_Chi_Minh
- Jira verify status clears after 20 s; log status clears after 10 s
