## Why

The HRM timesheet automation currently hardcodes time slots for exactly 1 or 2 tickets per day (single ticket: 9-12 + 13-18, two tickets: morning/afternoon split). In practice, work days often involve 3+ tickets, and the rigid time allocation doesn't reflect actual hours. Users need to log an arbitrary number of tickets with automatically-distributed time slots across the standard workday.

## What Changes

- **Remove the 1-2 ticket limit** — support N tickets per day (practical max: ~4-5 given an 8-hour workday)
- **Auto-distribute time slots** — divide the workday (09:00–12:00, 13:00–18:00) evenly across all tickets, instead of hardcoded morning/afternoon splits
- **Default time is the full workday** — always 09:00–18:00 with 12:00–13:00 lunch break, same as current behavior
- **Update the HRM API route** to accept more than 2 tickets (currently rejects `tickets.length > 2`)
- **Update the frontend** to allow entering/logging multiple tickets in one HRM session

## Capabilities

### New Capabilities
- `flexible-time-slots`: Time slot calculation logic that distributes N tickets evenly across the standard workday (09:00–12:00, 13:00–18:00)

### Modified Capabilities
- `log-date-selection`: No requirement changes — date selection behavior is unchanged

## Impact

- **`lib/browser-hrm.ts`** — `getTimeSlots()` function rewritten, `fillTaskPopup` and `logTicketsToHrm` updated for N tickets
- **`app/api/hrm/log/route.ts`** — Remove `tickets.length > 2` validation cap
- **`lib/types.ts`** — `HrmLogRequestBody.tickets` max length constraint relaxed
- **`components/LogForm.tsx`** — UI changes to support multiple ticket entry for HRM logging
- **No changes to TSC logging** — TSC Excel logging is single-ticket-per-cell and unaffected
