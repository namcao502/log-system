# Changelog

## [UI-REDESIGN] - 2026-04-03
### Changed
- Redesigned UI to dark mode with four stacked section cards: Tickets, Dates, Status, Actions
- Replaced native `<input type="date">` with `DatePickerPopover` (react-day-picker calendar popover, hidden real input preserved for a11y and tests)
- Added slide-in entry animation and fade/slide exit animation for ticket chips
- Added `fading` prop to `StatusIndicator` for 500ms fade-out before status clears
- Added `active:scale-95` press micro-interaction on all action buttons
- Color palette: slate-950 page bg, slate-800 cards, blue/teal/violet accents per action

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
- Playwright automation for writing to Excel Online (`lib/browser-log.ts`)
- Shared TypeScript interfaces for API request/response types (`lib/types.ts`)
- API routes: `GET /api/jira/verify`, `POST /api/sharepoint/log`
- Client-side MDP-xxxx format validation
