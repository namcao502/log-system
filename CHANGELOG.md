# Changelog

## [ROW-PER-PAIR-ENTRY] - 2026-04-24
### Changed
- Replaced two-panel (Tickets + Dates) UI with a row-per-pair entry table: each row is an independent (date, ticket) pair
- Ticket field auto-prefixes "MDP-" as you type bare digits; Jira verification fires on blur per row (no explicit Verify button)
- Rows are grouped by date before logging -- same-date rows are combined into one API call per destination
- TSC and HRM handlers iterate date groups sequentially; Log All still runs TSC and HRM in parallel
- `LogForm` state replaced: `stagedTickets + logDates + isJiraLoading` removed, replaced with `rows: LogRow[]`
- Removing the last row replaces it with a fresh empty row so the table is never blank
- Skip re-verification guard: blur on an already-verified unchanged ticket does not trigger a second Jira call
### Added
- `LogRowItem` component -- single editable row with `DatePickerPopover`, ticket input, `StatusBadge` (verified/invalid/verifying/idle), remove button, and summary line below
- `LogRow` interface in `lib/types.ts`: `{ id, date, ticket, status, summary? }`
- `LABELS.LOG_ENTRIES`, `ADD_ROW`, `TICKET_ROW_PLACEHOLDER`, `DATE_COL`, `TICKET_COL`, `LOG_HRM` constants
- `jest.environment.ts` -- custom Jest environment extending jsdom with Node 22 fetch globals for test suite
### Fixed
- `DatePickerPopover` popover minimum width raised to `Math.max(triggerWidth, 280)` so the calendar renders correctly inside narrow grid columns
### Removed
- `LABELS.TICKETS`, `DATES`, `CLEAR_ALL`, `ADD`, `VERIFY`, `VERIFYING`, `TICKET_PLACEHOLDER`, `TICKET_FORMAT_ERROR`, `NO_SUMMARY`, `TICKET`, `DATE`, `ON` -- all unused after rewrite

## [MATERIAL-YOU-REDESIGN] - 2026-04-22
### Changed
- Replaced glassmorphism (backdrop-blur, semi-transparent `glass` / `glass-strong` utilities) with Material You (MD3) solid tonal surface system
- Removed aurora animated blob background (5 radial gradient blobs + all `aurora-blob-*` keyframe animations)
- `globals.css` defines MD3 color tokens (`--md-primary`, `--md-primary-container`, `--md-surface-container-*`, `--md-outline-variant`, etc.) all derived from `--theme-hue` so ThemePicker and rainbow mode still drive the full palette dynamically
- Surface utilities: `md-surface` (cards/popovers), `md-surface-high` (nested containers), `md-list-item` (tonal item rows)
- Button utilities: `md-btn-filled` (Verify/Add — primary filled), `md-btn-tonal` (Log TSC/HRM — secondary tonal), `md-btn-accent` (Log All — elevated container); all pill-shaped (`border-radius: 9999px`)
- Input utility: `md-input` (outlined text field with primary focus ring)
- All `text-white/XX` opacity tokens replaced with MD3 semantic variables (`--md-on-surface`, `--md-on-surface-variant`)
- Background lightness raised from 7% to 11%; surface containers step at 14/17/21/25% for tonal elevation
- Toast `backdrop-blur-xl` removed; toasts use solid `--md-surface-container` background
- Cards use `rounded-2xl`, nested containers `rounded-xl`, list items `rounded-xl`
- DatePickerPopover day buttons changed to `rounded-full` (MD3 calendar style)
### Added
- 4-corner SVG polygon animations: 12 unique polygon outlines (3 per corner) that scale from nearly zero and fade over 6 s with 2 s stagger
- Each corner has a distinct shape family: TL sharp/triangular, TR concave/notched, BL stepped/architectural, BR organic/asymmetric
- TR/BL/BR corners mirror TL shapes via SVG group `transform="scale(-1,1|1,-1|-1,-1)"` so all shapes point inward
- Shapes use hue offsets (+0, +28, +56 from `--theme-hue`) for a subtle tonal color drift across the three ripple rings
- `overflow="visible"` set as SVG attribute (not CSS style) for correct cross-browser SVG clipping behavior
- `transform-origin: 0 0` references the SVG viewport origin (= screen corner) without needing `transform-box`

## [AURORA-GLASSMORPHISM-UI] - 2026-04-21
### Changed
- Applied aurora animated background (`aurora-blob-*`) with 5 radial gradient blobs that float via CSS keyframe animations
- All cards and popovers use glassmorphism (`glass` utility class: `backdrop-blur`, semi-transparent background, border glow)
- Aurora blobs and background body color all respond to `--theme-hue` for a unified theme

## [RAINBOW-THEME] - 2026-04-21
### Added
- Rainbow mode in `ThemePicker`: animates `--theme-hue` continuously via `requestAnimationFrame`
- Hue position is saved to `localStorage` on `beforeunload` and restored on next load
- Rainbow state toggled with a single gradient button; stopping rainbow snaps to the current animated hue
### Changed
- `ThemePicker` dialog uses `role="dialog"` and `aria-label` for accessibility compliance

## [LOGPANEL-STREAMLINE] - 2026-04-21
### Changed
- Removed prefix `<span>` from `LogPanel`; log lines render as plain text inside the `<pre>` block
- Log line format is now emitted fully by the backend stream rather than split at the component level

## [BROWSER-CHANNEL-CHROME] - 2026-04-21
### Fixed
- Changed Playwright browser channel from `msedge` to `chrome` in both `browser-tsc.ts` and `browser-hrm.ts`

## [THEME-SYSTEM] - 2026-04-15
### Added
- CSS custom property theme: `--theme-hue` drives `--t-50` through `--t-800` tokens in `globals.css`
- `useTheme` hook (`lib/useTheme.ts`): persists chosen color to `localStorage`, extracts hue via `hexToHue`
- `ThemePicker` component: color picker popover wired into `AppShell` header
- `ThemePicker` wired to `useTheme` in `AppShell`; all components reference `--t-*` variables instead of hard-coded emerald/teal classes

## [RENAME-BROWSER-TSC] - 2026-04-13
### Changed
- Renamed `lib/browser-log.ts` to `lib/browser-tsc.ts` for consistency with `browser-hrm.ts`
- Log prefix changed from `[browser-log]` to `[tsc-log]` in all stream output
- Added date validation in `app/api/sharepoint/log/route.ts` and `app/api/hrm/log/route.ts`

## [TEAL-RETHEME-NOTIFICATIONS] - 2026-04-03
### Added
- Notification bell (`NotificationBell.tsx`) with unread badge and dropdown of past log events
- Toast system (`Toast.tsx`, `ToastContainer.tsx`) for transient success/error feedback (4 s auto-dismiss)
- `useNotifications` hook: persistent notification list (addNotification, markRead, clearAll)
- `useToasts` hook: transient toast list (addToast, dismissToast)
- `AppShell.tsx` client shell that wires notifications + toasts and renders header + `LogForm`
- `LogPanel.tsx` scrollable dark-terminal block for streaming log output
### Changed
- Rethemed entire UI from dark/slate to teal/emerald gradient palette
- `page.tsx` now renders `AppShell` instead of `LogForm` directly

## [LOGFORM-LAYOUT-RESTRUCTURE] - 2026-04-03
### Changed
- Restructured `LogForm` layout: tickets/dates in a top row, two-column status section, reorganized actions

## [UI-REDESIGN] - 2026-04-03
### Changed
- Redesigned UI to dark mode with four stacked section cards: Tickets, Dates, Status, Actions
- Replaced native `<input type="date">` with `DatePickerPopover` (react-day-picker calendar popover, hidden real input preserved for a11y and tests)
- Added slide-in entry animation and fade/slide exit animation for ticket chips
- Added `fading` prop to `StatusIndicator` for 500ms fade-out before status clears
- Added `active:scale-95` press micro-interaction on all action buttons

## [UX-IMPROVEMENTS] - 2026-04-03
### Changed
- Input label renamed from "Task:" to "Ticket:"
- Tickets section heading shows "Tickets (N/5)" when staged list is non-empty
- Added "Clear All" button in Tickets header (visible only when staged tickets exist)
- Staged tickets cleared after any successful Log TSC / Log HRM / Log All
- Inline format validation: red ring + "Use MDP-xxxx format" hint while typing invalid input
- Jira verify auto-clear extended from 10s to 20s
- Focus auto-moves to date picker after successful verify

## [LAYOUT-REORDER] - 2026-04-03
### Changed
- Jira status row and staged ticket list moved into the Tickets section card
- Summary banner ("Will log: X on Y") moved below the Status section

## [AUTO-STAGE-SUMMARY-BANNER] - 2026-04-02
### Added
- Tickets are auto-staged after Jira verification (no manual "Add to HRM" step)
- Summary banner shows exactly which tickets will be logged to which dates
- `stagedTickets` state replaces `hrmTickets`; max 5 tickets enforced at verify time
- Multi-date support: log to multiple dates in one action via `logDates[]` array

## [LOG-ALL-BUTTON] - 2026-03-20
### Added
- "Log All" button fires both TSC Excel log and HRM timesheet log in parallel (`Promise.all`)
- Independent status reporting: TSC and HRM statuses update separately during parallel run
- `isLogging` guard disables all three log buttons while any log operation is in flight

## [HRM-LOG-BUTTON] - 2026-03-19
### Added
- Standalone "Log HRM" button calls `POST /api/hrm/log` independently
- HRM API route (`app/api/hrm/log/route.ts`) and Playwright automation (`lib/browser-hrm.ts`)
- Separate `hrmStatus` state in `LogForm` for independent HRM operation feedback
- Accepts up to 5 tickets per request; validates MDP-xxxx format server-side

## [FEAT-DAILY-LOG] - 2026-03-05
### Added
- Single-page UI with ticket input, Jira verification, and SharePoint logging (LogForm, StatusIndicator)
- Jira REST API integration for MDP-xxxx ticket verification (`lib/jira.ts`)
- Playwright automation for writing to Excel Online (`lib/browser-tsc.ts`)
- Shared TypeScript interfaces for API request/response types (`lib/types.ts`)
- API routes: `GET /api/jira/verify`, `POST /api/sharepoint/log`
- Client-side MDP-xxxx format validation
