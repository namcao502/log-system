# TSC Daily Log System

A personal productivity tool that automates logging Jira tickets (MDP-xxxx) to a shared SharePoint Excel file and an HRM timesheet.

## What It Does

1. Add rows to the entry table -- each row is one (date, ticket) pair
2. Type a ticket number (e.g. `1234`) -- auto-prefixed to `MDP-1234`; Jira verifies it on blur
3. Different tickets on different dates can be set up in a single session (e.g. Monday: MDP-1234, Tuesday: MDP-5678)
4. Same-date rows are automatically combined into one log entry
5. Click **Log TSC**, **Log HRM**, or **Log All** to write to SharePoint Excel, HRM, or both in parallel

## Tech Stack

- **Next.js 15** (App Router) + TypeScript (strict)
- **Tailwind CSS**
- **Playwright** (Chrome) for browser automation
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
  globals.css                 # Tailwind directives, MD3 color tokens, surface/button utilities, corner SVG animation CSS
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
  useTheme.ts                 # Hook: CSS variable theme system with localStorage persistence
components/
  AppShell.tsx                # Client shell - wires notifications, toasts, theme, renders header + LogForm
  LogForm.tsx                 # Main client component - rows: LogRow[] state, groupByDate, log orchestration
  LogRowItem.tsx              # Single entry row - DatePickerPopover + ticket input + StatusBadge + remove
  LogPanel.tsx                # Scrollable dark-terminal pre block for streaming log lines
  DatePickerPopover.tsx       # Calendar popover (react-day-picker) with hidden <input type="date">
  NotificationBell.tsx        # Bell icon with unread badge and dropdown
  ThemePicker.tsx             # Color picker popover with rainbow animation mode
  Toast.tsx                   # Single auto-dismissing toast (4 s)
  ToastContainer.tsx          # Fixed top-right stack of active toasts
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

## Theme System

The UI uses a Material You (MD3) dark scheme driven by a single CSS custom property `--theme-hue`:

- `globals.css` defines MD3 color tokens (`--md-primary`, `--md-surface-container-*`, `--md-outline-variant`, etc.) all as `hsl(var(--theme-hue), ...)` expressions, so changing `--theme-hue` repaints the entire UI
- `useTheme` hook (`lib/useTheme.ts`) reads/writes the chosen hex color via `localStorage`, converts it to a hue via `hexToHue`, and sets `--theme-hue` on `document.documentElement`
- `ThemePicker` component provides a color picker popover with a **Rainbow** mode that animates `--theme-hue` continuously via `requestAnimationFrame`
- Surface elevation is expressed through lightness steps in the surface container tokens (no backdrop-filter or blur)
- Four corner SVG polygon animations use stroke colors derived from `--theme-hue` with hue offsets (+0/+28/+56) so they stay in harmony with the chosen color

## Excel File Details

- **File:** TSC Development WIP.xlsx (Dave Markert's OneDrive)
- **Sheet:** Daily Reports - 2026
- **Column B:** Dates (M/D/YYYY)
- **Column M:** Log target column (`TARGET_COLUMN` in `browser-tsc.ts`)
- **Row formula:** `row = 2 + dayOfYear`
- Multiple tickets are appended with `, ` separator

## Notes

- Ticket format: `MDP-\d+` -- auto-prefixed as you type; no need to type "MDP-"
- Each row is verified individually on blur; already-verified rows skip re-verification
- Same-date rows are grouped and logged in one combined API call per destination
- Dates stored as `YYYY-MM-DD`, displayed via `Intl.DateTimeFormat`
- Timezone: Asia/Ho_Chi_Minh
- Browser channel: Chrome (both TSC and HRM Playwright sessions)
