// UI labels and notification strings

export const LABELS = {
  // Section headings
  STATUS: "Status",
  ACTIONS: "Actions",
  TSC_LOG: "TSC Log",
  HRM_LOG: "HRM Log",

  // Buttons
  LOG_TSC: "Log TSC",
  LOG_HRM: "Log HRM",
  WILL_LOG: "Will log:",

  // DatePickerPopover
  PICK_A_DATE: "Pick a date",
  DATE_PICKER_ARIA: "Date picker",

  // LogRowItem
  LOG_ENTRIES: "Log Entries",
  ADD_ROW: "Add row",
  TICKET_ROW_PLACEHOLDER: "1234",
  DATE_COL: "Date",
  TICKET_COL: "Ticket",
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
