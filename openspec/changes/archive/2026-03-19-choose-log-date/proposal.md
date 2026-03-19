## Why

Currently, both the TSC and HRM log operations always target today's date, computed at request time. If a user forgets to log a ticket on the day they worked on it, they have no way to backfill — they must manually navigate each system. Adding a date picker lets users log to any date within the current year.

## What Changes

- Add a date input field to the `LogForm` UI, defaulting to today (Vietnam timezone).
- Pass the selected date from the frontend to both `POST /api/sharepoint/log` and `POST /api/hrm/log` as an ISO date string.
- Update `browser-log.ts` (`writeTicketViaPlaywright`) to accept a `date` parameter and derive the target cell row from it instead of always using today.
- Update `browser-hrm.ts` (`logTicketsToHrm`) to accept a `date` parameter and use it when matching the day row on the HRM timesheet.

## Capabilities

### New Capabilities

- `log-date-selection`: UI date picker defaulting to today; selected date is passed through the API and used by both Playwright automations to target the correct row/day.

### Modified Capabilities

<!-- None — no existing specs to update. -->

## Impact

- `components/LogForm.tsx` — add date state, date input, pass date to both API calls
- `lib/types.ts` — add optional `date` field to `LogRequestBody` and `HrmLogRequestBody`
- `app/api/sharepoint/log/route.ts` — forward `date` to `writeTicketViaPlaywright`
- `app/api/hrm/log/route.ts` — forward `date` to `logTicketsToHrm`
- `lib/browser-log.ts` — `writeTicketViaPlaywright` accepts optional `date` param; `getTodayCell` becomes `getCellForDate(date)`
- `lib/browser-hrm.ts` — `logTicketsToHrm` accepts optional `date` param; date string computation becomes `getDateString(date)`
- `__tests__/LogForm.test.tsx` — update tests to include date field in API call assertions
