## 1. Types

- [x] 1.1 Add optional `date?: string` field to `LogRequestBody` in `lib/types.ts`
- [x] 1.2 Add optional `date?: string` field to `HrmLogRequestBody` in `lib/types.ts`

## 2. Browser Automations

- [x] 2.1 Refactor `getTodayCell()` in `lib/browser-log.ts` into `getCellForDate(date: Date)` that accepts a date parameter
- [x] 2.2 Update `writeTicketViaPlaywright` in `lib/browser-log.ts` to accept optional `date?: Date` and pass it to `getCellForDate` (defaults to `new Date()` when absent)
- [x] 2.3 Refactor `getTodayString()` in `lib/browser-hrm.ts` into `getDateString(date: Date)` that accepts a date parameter
- [x] 2.4 Update `logTicketsToHrm` in `lib/browser-hrm.ts` to accept optional `date?: Date` and pass it to `getDateString` (defaults to `new Date()` when absent)

## 3. API Routes

- [x] 3.1 Update `app/api/sharepoint/log/route.ts` to read optional `date` from request body, parse to `Date` object, and forward to `writeTicketViaPlaywright`
- [x] 3.2 Update `app/api/hrm/log/route.ts` to read optional `date` from request body, parse to `Date` object, and forward to `logTicketsToHrm`

## 4. Frontend

- [x] 4.1 Add `selectedDate` state to `LogForm` in `components/LogForm.tsx`, defaulting to today's date in `YYYY-MM-DD` format (Vietnam timezone via `Intl`)
- [x] 4.2 Add a date `<input type="date">` to the form UI, bound to `selectedDate`, with `min` and `max` constrained to January 1 – December 31 of the current year (Vietnam timezone)
- [x] 4.3 Reset `selectedDate` to today when the ticket input changes (in `handleTicketChange`)
- [x] 4.4 Pass `date: selectedDate` in the fetch body for `handleLogTsc`
- [x] 4.5 Pass `date: selectedDate` in the fetch body for `handleLogHrm`

## 5. Tests

- [x] 5.1 Update `__tests__/LogForm.test.tsx` — add `date` field to all fetch body assertions for "Log TSC" and "Log HRM" tests
- [x] 5.2 Add test: date input renders with today's value on initial render
- [x] 5.3 Add test: changing ticket input resets date to today
- [x] 5.4 Add test: selecting a different date causes Log TSC to send that date
- [x] 5.5 Add test: selecting a different date causes Log HRM to send that date
- [x] 5.6 Run full test suite and confirm all tests pass
