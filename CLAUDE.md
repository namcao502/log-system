# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TSC Daily Log System** — A personal productivity tool that automates logging Jira tickets (MDP-xxxx) to a shared SharePoint Excel file ("TSC Development WIP.xlsx"). Built for a single user (Nam Nguyen) at TSC/New Ocean Infosys.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict mode, no `any`)
- **Styling:** Tailwind CSS
- **Testing:** Jest + React Testing Library
- **Auth:** Azure AD Client Credentials Flow (no user login required)
- **External APIs:** Jira Cloud REST API, Microsoft Graph API

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run all tests
npx jest <file>      # Run a single test file
```

## Architecture

```
app/
  page.tsx              # Server component — welcome header, Vietnamese date, renders LogForm
  layout.tsx            # Root layout with Inter font
  globals.css           # Tailwind directives + body styling
  api/
    jira/
      verify/route.ts   # GET /api/jira/verify?ticket=MDP-xxxx — validates ticket exists
    sharepoint/
      log/route.ts      # POST /api/sharepoint/log — writes ticket to Excel cell
lib/
  types.ts              # Shared interfaces: JiraVerifyResponse, LogResponse, LogRequestBody
  jira.ts               # Jira REST API client (Basic auth, API token from env)
  graph.ts              # MS Graph API client (client credentials flow, token caching)
  excel.ts              # Excel cell lookup (find date row in col B, write to col O)
components/
  LogForm.tsx           # Client component — ticket input, verify/log buttons, async status state
  StatusIndicator.tsx   # Client component — colored dot/spinner/check/cross status display
__tests__/
  LogForm.test.tsx      # LogForm integration tests
  StatusIndicator.test.tsx # StatusIndicator unit tests
  jira.test.ts          # Jira API client tests
  excel.test.ts         # Excel write logic tests
```

### Data Flow

1. User enters `MDP-xxxx` in the input field
2. Frontend calls `/api/jira/verify?ticket=MDP-xxxx`
3. API route checks Jira Cloud: `GET /rest/api/3/issue/MDP-xxxx`
4. If valid, frontend calls `POST /api/sharepoint/log` with `{ ticket, date }`
5. API route uses MS Graph to find the cell (current date row × Nam Nguyen column) in the shared Excel file and writes the ticket ID

### External Services

| Service | Base URL | Auth method |
|---------|----------|-------------|
| Jira Cloud | `https://newoceaninfosys.atlassian.net` | Basic auth (email + API token) |
| MS Graph (Excel) | `https://graph.microsoft.com/v1.0` | Client credentials (Azure AD app) |
| SharePoint Excel | Dave Markert's OneDrive shared file | Accessed via MS Graph drive item API |

### Environment Variables

```
JIRA_BASE_URL=https://newoceaninfosys.atlassian.net
JIRA_EMAIL=<atlassian account email>
JIRA_API_TOKEN=<atlassian API token>

AZURE_CLIENT_ID=<azure ad app client id>
AZURE_CLIENT_SECRET=<azure ad app client secret>
AZURE_TENANT_ID=<azure ad tenant id>

SHAREPOINT_DRIVE_ITEM_ID=<drive item id of the Excel file>
```

## Conventions

- All API secrets live in `.env.local`, never committed
- API routes handle all external service calls — frontend never calls Jira or MS Graph directly
- UI text is in English
- Components use `"use client"` only when they need hooks or event handlers
- Shared request/response types live in `lib/types.ts` — imported by both API routes and components
- Async operation state uses a discriminated union (`AsyncStatus`) with four states: `idle | loading | success | error`
- `StatusIndicator` is a reusable component for showing operation progress (colored dot, spinner, checkmark, or cross)
