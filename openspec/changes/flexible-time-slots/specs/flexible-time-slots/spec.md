## ADDED Requirements

### Requirement: Time slots are evenly distributed across N tickets
The `getTimeSlots` function SHALL accept a ticket count (1–5) and ticket index, and return time slots that evenly divide the 8-hour workday (09:00–12:00 morning, 13:00–18:00 afternoon) across all tickets. Each ticket SHALL receive `floor(480 / N)` minutes, with any remainder added to the last ticket.

#### Scenario: Single ticket gets full day
- **WHEN** `getTimeSlots` is called with ticketCount=1, ticketIndex=0
- **THEN** it SHALL return two slots: `{ start: "09:00", end: "12:00" }` and `{ start: "13:00", end: "18:00" }`

#### Scenario: Two tickets split evenly (240 min each)
- **WHEN** `getTimeSlots` is called with ticketCount=2, ticketIndex=0
- **THEN** ticket 0 SHALL receive slots covering 09:00–13:00 (split across lunch: 09:00–12:00 + 13:00–14:00)
- **AND WHEN** called with ticketCount=2, ticketIndex=1
- **THEN** ticket 1 SHALL receive a slot covering 14:00–18:00

#### Scenario: Three tickets split evenly (160 min each)
- **WHEN** `getTimeSlots` is called with ticketCount=3
- **THEN** each ticket SHALL receive approximately 160 minutes of time slots
- **AND** the slots SHALL fill the full workday from 09:00 to 18:00 with no gaps (except the 12:00–13:00 lunch)

#### Scenario: Five tickets (maximum)
- **WHEN** `getTimeSlots` is called with ticketCount=5
- **THEN** each ticket SHALL receive approximately 96 minutes
- **AND** the last ticket SHALL receive any remainder minutes

### Requirement: Slots crossing lunch break are split into two rows
When a ticket's allocated time spans the 12:00–13:00 lunch break, the function SHALL split it into two time rows: one ending at 12:00 and one starting at 13:00.

#### Scenario: Ticket time crosses lunch boundary
- **WHEN** a ticket's allocated block includes both 11:40 and 13:20
- **THEN** the function SHALL return two slots: one ending at "12:00" and one starting at "13:00"
- **AND** the total duration of both slots SHALL equal the allocated minutes

### Requirement: Times are rounded to 5-minute increments
All start and end times SHALL be rounded to the nearest 5-minute boundary to produce clean time values.

#### Scenario: Calculated time is not on a 5-minute mark
- **WHEN** the even distribution produces a time of 11:42
- **THEN** it SHALL be rounded to "11:40"

### Requirement: HRM API accepts up to 5 tickets
The `POST /api/hrm/log` route SHALL accept between 1 and 5 tickets in the `tickets` array. Requests with 0 or more than 5 tickets SHALL be rejected with a 400 status.

#### Scenario: Request with 3 tickets
- **WHEN** the request body contains `{ "tickets": ["MDP-1", "MDP-2", "MDP-3"], "date": "2026-03-19" }`
- **THEN** the route SHALL accept the request and process all 3 tickets

#### Scenario: Request with 6 tickets
- **WHEN** the request body contains 6 tickets
- **THEN** the route SHALL return 400 with error "Expected 1 to 5 tickets."

### Requirement: Frontend supports multiple ticket entry for HRM
The LogForm component SHALL allow users to build a list of verified tickets (up to 5) for HRM logging. Each ticket must be individually verified via Jira before being added to the list. The "Log HRM" button SHALL send all listed tickets in a single request.

#### Scenario: User adds multiple tickets to the HRM list
- **WHEN** the user verifies ticket "MDP-100" and adds it to the list
- **AND** verifies "MDP-200" and adds it
- **THEN** clicking "Log HRM" SHALL send `{ "tickets": ["MDP-100", "MDP-200"], "date": "..." }`

#### Scenario: User cannot add more than 5 tickets
- **WHEN** the HRM ticket list already contains 5 tickets
- **THEN** the "Add to HRM" action SHALL be disabled

#### Scenario: Log TSC remains single-ticket
- **WHEN** the user clicks "Log TSC"
- **THEN** it SHALL send only the currently-entered ticket, ignoring the HRM list
