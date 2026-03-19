## Context

The HRM timesheet at `hrm.nois.vn` requires each task entry to have a project, ticket ID, issue type, and one or more time rows (start/end times). Currently `getTimeSlots()` in `browser-hrm.ts` hardcodes exactly two patterns:
- 1 ticket → two rows: 09:00-12:00, 13:00-18:00 (8h total)
- 2 tickets → ticket 0 gets morning, ticket 1 gets afternoon

The API route also enforces `tickets.length > 2` as a hard rejection. The frontend sends a single ticket in an array.

## Goals / Non-Goals

**Goals:**
- Support 1–5 tickets per HRM log session with automatically distributed time slots
- Always use the full workday: 09:00–12:00, 13:00–18:00 (8 working hours, lunch gap preserved)
- Update API validation to accept up to 5 tickets
- Update frontend to allow entering multiple tickets for HRM

**Non-Goals:**
- Custom time entry UI (user manually picking start/end per ticket) — keep it automatic
- Changing TSC Excel logging (remains single-ticket)
- Supporting tickets across multiple days in one request
- Changing the HRM popup interaction flow (project selection, save button, etc.)

## Decisions

### 1. Time distribution algorithm

**Decision:** Divide the 8 working hours evenly across N tickets. Each ticket gets `floor(480 / N)` minutes. Remainder minutes go to the last ticket.

**Workday blocks:**
- Morning: 09:00–12:00 (180 min)
- Afternoon: 13:00–18:00 (300 min)

Fill morning first, overflow into afternoon. A ticket's time may span the lunch break — split it into two rows (end at 12:00, resume at 13:00).

**Why not equal blocks with no splitting?** Splitting across lunch is simpler than trying to fit exact durations into fixed blocks. The HRM system accepts multiple time rows per task.

**Example distributions:**
| Tickets | Per ticket | Distribution |
|---------|-----------|--------------|
| 1 | 480 min | 09:00-12:00, 13:00-18:00 |
| 2 | 240 min | T1: 09:00-12:00 + 13:00-14:00, T2: 14:00-18:00 |
| 3 | 160 min | T1: 09:00-11:40, T2: 11:40-12:00 + 13:00-15:20, T3: 15:20-18:00 |
| 4 | 120 min | T1: 09:00-11:00, T2: 11:00-12:00 + 13:00-14:00, T3: 14:00-16:00, T4: 16:00-18:00 |
| 5 | 96 min | Evenly spaced, last gets remainder |

### 2. Frontend multi-ticket entry

**Decision:** Add a ticket list to the HRM flow. After verifying a ticket, the user can add it to a list (up to 5). The "Log HRM" button sends all listed tickets. The "Log TSC" button continues to send only the currently-entered ticket.

**Why a list approach over a comma-separated input?** Each ticket needs Jira verification. A list lets us verify one at a time and show per-ticket status. Keeps the existing verify-then-log flow intact.

### 3. API validation change

**Decision:** Change `tickets.length > 2` to `tickets.length > 5` in `app/api/hrm/log/route.ts`. Simple constant change.

## Risks / Trade-offs

- **Lunch-gap splitting adds complexity** → Mitigated by extracting time slot logic into a well-tested pure function. The `getTimeSlots` function becomes the most important unit to test.
- **HRM popup may behave differently with many time rows** → The current code adds rows one by one with the `+` button. Should work for up to 5 tickets (max ~10 time rows). Low risk since the UI already supports multiple rows.
- **Frontend state complexity increases with a ticket list** → Keep it simple: array of `{ ticket: string, summary: string }` items. No drag-and-drop or reordering needed.
