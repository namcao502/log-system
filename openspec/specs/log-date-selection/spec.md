### Requirement: Date picker defaults to today
The UI SHALL display a date input that defaults to the current date in the Asia/Ho_Chi_Minh timezone. The default SHALL be recomputed each time the user clears or changes the ticket input.

#### Scenario: Date picker shows today on first render
- **WHEN** the form is rendered
- **THEN** the date input value SHALL equal today's date in `YYYY-MM-DD` format (Vietnam timezone)

#### Scenario: Date picker resets to today when ticket input is cleared
- **WHEN** the user clears the ticket input field
- **THEN** the date input value SHALL reset to today's date in `YYYY-MM-DD` format

### Requirement: User can select any date within the current year
The date input SHALL constrain selectable dates to within the current calendar year (January 1 – December 31, Vietnam timezone). Dates outside this range SHALL be rejected by the UI.

#### Scenario: User selects a past date in the current year
- **WHEN** the user selects a past date within the current year
- **THEN** the selected date SHALL be stored in component state
- **AND** the "Log TSC" and "Log HRM" buttons SHALL use that date when clicked

#### Scenario: User selects a future date in the current year
- **WHEN** the user selects a future date within the current year
- **THEN** the selected date SHALL be accepted and stored

### Requirement: Selected date is sent with every log request
Both `POST /api/sharepoint/log` and `POST /api/hrm/log` requests SHALL include the selected date as an ISO date string (`YYYY-MM-DD`) in the request body under the `date` field.

#### Scenario: Log TSC sends selected date
- **WHEN** the user clicks "Log TSC" with a date selected
- **THEN** the request body SHALL contain `{ "ticket": "<id>", "date": "<YYYY-MM-DD>" }`

#### Scenario: Log HRM sends selected date
- **WHEN** the user clicks "Log HRM" with a date selected
- **THEN** the request body SHALL contain `{ "tickets": ["<id>"], "date": "<YYYY-MM-DD>" }`

### Requirement: API routes accept and forward optional date parameter
The `POST /api/sharepoint/log` and `POST /api/hrm/log` route handlers SHALL accept an optional `date` field (`YYYY-MM-DD` string). When present, it SHALL be parsed and forwarded to the underlying browser automation. When absent, the automation SHALL default to today.

#### Scenario: Route receives date and forwards it
- **WHEN** the request body contains a valid `date` field
- **THEN** the route handler SHALL pass a `Date` object derived from that string to the automation function

#### Scenario: Route receives no date and uses today
- **WHEN** the request body omits the `date` field
- **THEN** the automation function SHALL be called without a date argument and SHALL use today

### Requirement: TSC browser automation targets the row for the given date
`writeTicketViaPlaywright` SHALL accept an optional `date: Date` parameter. When provided, it SHALL compute `dayOfYear` from that date (Vietnam timezone) to determine the target cell row. When absent, it SHALL use today as before.

#### Scenario: Logging to a past date writes to the correct row
- **WHEN** `writeTicketViaPlaywright` is called with a `date` of January 1
- **THEN** it SHALL navigate to row 3 (HEADER_ROWS=2 + dayOfYear=1)

### Requirement: HRM browser automation targets the day row for the given date
`logTicketsToHrm` SHALL accept an optional `date: Date` parameter. When provided, it SHALL format the date as `DD/MM/YYYY` (Vietnam timezone) and use that string to locate the correct day header on the timesheet page. When absent, it SHALL use today as before.

#### Scenario: Logging to a past date matches the correct day row
- **WHEN** `logTicketsToHrm` is called with a `date` of March 1, 2026
- **THEN** it SHALL search the page for the row labeled `"01/03/2026"`
