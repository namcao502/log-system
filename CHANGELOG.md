# Changelog

## [FEAT-daily-log] - 2026-03-05
### Added
- Single-page UI with ticket input, Jira verification, and SharePoint logging (LogForm, StatusIndicator)
- Jira REST API integration for MDP-xxxx ticket verification (lib/jira.ts)
- MS Graph API integration with client credentials flow and token caching (lib/graph.ts)
- SharePoint Excel writer that locates date row and appends ticket to "Nam Nguyen" column (lib/excel.ts)
- Shared TypeScript interfaces for API request/response types (lib/types.ts)
- API routes: GET /api/jira/verify, POST /api/sharepoint/log
- Client-side MDP-xxxx format validation
- 53 tests across 4 test files (LogForm, StatusIndicator, jira, excel)
