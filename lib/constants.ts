// UI labels and notification strings

export const LABELS = {
  // Section headings
  TICKETS: "Tickets",
  DATES: "Dates",
  STATUS: "Status",
  ACTIONS: "Actions",
  TSC_LOG: "TSC Log",
  HRM_LOG: "HRM Log",

  // Field labels
  TICKET: "Ticket:",
  DATE: "Date:",

  // Buttons
  CLEAR_ALL: "Clear All",
  ADD: "Add",
  VERIFY: "Verify",
  VERIFYING: "Verifying...",
  LOG_TSC: "Log TSC",
  WILL_LOG: "Will log:",
  ON: "on",

  // Input
  TICKET_PLACEHOLDER: "MDP-1234 or MDP-1234, MDP-5678",
  TICKET_FORMAT_ERROR: "Use MDP-xxxx format",
  NO_SUMMARY: "No summary",

  // DatePickerPopover
  PICK_A_DATE: "Pick a date",
  DATE_PICKER_ARIA: "Date picker",
} as const;

export const NOTIFY = {
  JIRA_FAILED: "Jira failed",
  JIRA_VERIFIED: "Jira verified",
  TSC_FAILED: "TSC failed",
  TSC_LOGGED: "TSC logged",
  HRM_FAILED: "HRM failed",
  HRM_LOGGED: "HRM logged",

  ERR_JIRA_API: "Failed to reach Jira API",
  ERR_LOG: "Failed to log",
  ERR_EXCEL: "Failed to write to Excel",
  ERR_HRM: "Failed to log to HRM",
  ERR_HRM_API: "Failed to reach HRM",
  ERR_STREAM: "Stream ended unexpectedly",
} as const;
