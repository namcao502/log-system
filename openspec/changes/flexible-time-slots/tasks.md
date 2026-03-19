## 1. Core Time Slot Logic

- [x] 1.1 Rewrite `getTimeSlots()` in `lib/browser-hrm.ts` to evenly distribute 480 minutes across N tickets (1–5), splitting slots that cross the 12:00–13:00 lunch break into two rows, and rounding times to 5-minute increments
- [x] 1.2 Write unit tests for `getTimeSlots` covering: 1 ticket, 2 tickets, 3 tickets, 5 tickets, lunch-break splitting, 5-min rounding

## 2. API Route Update

- [x] 2.1 Change `tickets.length > 2` to `tickets.length > 5` in `app/api/hrm/log/route.ts` and update the error message to "Expected 1 to 5 tickets."

## 3. Frontend Multi-Ticket Entry

- [x] 3.1 Add HRM ticket list state to `LogForm.tsx`: `hrmTickets: Array<{ ticket: string; summary: string }>` (max 5)
- [x] 3.2 Add "Add to HRM" button that appends the currently verified ticket to the HRM list (disabled when list has 5 items or ticket already in list)
- [x] 3.3 Display the HRM ticket list with remove buttons for each item
- [x] 3.4 Update "Log HRM" button to send all tickets from the HRM list (instead of just the current ticket) and disable when list is empty
- [x] 3.5 Keep "Log TSC" button unchanged — sends only the currently-entered single ticket

## 4. Testing & Verification

- [x] 4.1 Update `__tests__/LogForm.test.tsx` for multi-ticket HRM flow (add to list, remove from list, send all)
- [x] 4.2 Run full test suite (`npm test`) and verify all tests pass
- [ ] 4.3 Manual test (requires running app): log 1, 2, and 3 tickets via HRM and verify time slots in the timesheet
