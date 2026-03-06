# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TSC Daily Log System** — A personal productivity tool that automates logging Jira tickets (MDP-xxxx) to a shared SharePoint Excel file ("TSC Development WIP.xlsx"). Built for a single user (Nam Nguyen) at TSC/New Ocean Infosys.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict mode, no `any`)
- **Styling:** Tailwind CSS
- **Testing:** Jest + React Testing Library
- **Browser Automation:** Playwright (Edge) — writes to Excel Online via browser
- **External APIs:** Jira Cloud REST API

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
      log/route.ts      # POST /api/sharepoint/log — triggers Playwright to write to Excel
lib/
  types.ts              # Shared interfaces: JiraVerifyResponse, LogResponse, LogRequestBody
  jira.ts               # Jira REST API client (Basic auth, API token from env)
  browser-log.ts        # Playwright automation — opens Excel Online, navigates to cell, types ticket
components/
  LogForm.tsx           # Client component — ticket input, verify/log buttons, async status state
  StatusIndicator.tsx   # Client component — colored dot/spinner/check/cross status display
__tests__/
  LogForm.test.tsx      # LogForm integration tests
  StatusIndicator.test.tsx # StatusIndicator unit tests
  jira.test.ts          # Jira API client tests
```

### Data Flow

1. User enters `MDP-xxxx` in the input field
2. Frontend calls `/api/jira/verify?ticket=MDP-xxxx`
3. API route checks Jira Cloud: `GET /rest/api/3/issue/MDP-xxxx`
4. If valid, frontend calls `POST /api/sharepoint/log` with `{ ticket }`
5. API route launches Playwright (Edge), opens the shared Excel file in Excel Online, navigates to today's cell (column O, row = 2 + dayOfYear), and types the ticket ID

### Excel File Details

- **File:** TSC Development WIP.xlsx (Dave Markert's OneDrive)
- **Worksheet:** "Daily Reports - 2026"
- **Column B:** Dates in M/D/YYYY format
- **Column O:** "Nam Nguyen" — target column for logging
- **Row formula:** row = 2 (header rows) + dayOfYear
- **Multiple tickets:** Appended with `, ` separator
- **Timezone:** Asia/Ho_Chi_Minh

### External Services

| Service | Base URL | Auth method |
|---------|----------|-------------|
| Jira Cloud | `https://newoceaninfosys.atlassian.net` | Basic auth (email + API token) |
| SharePoint Excel | Dave Markert's OneDrive shared file | Playwright uses saved browser session (first login required) |

### Environment Variables

```
JIRA_BASE_URL=https://newoceaninfosys.atlassian.net
JIRA_EMAIL=<atlassian account email>
JIRA_API_TOKEN=<atlassian API token>
```

### Playwright Browser Profile

Playwright stores its persistent browser session at `~/.tsc-daily-log-browser/`. First run requires manual Microsoft login in the Playwright browser window. Subsequent runs reuse the saved cookies.

## Conventions

- All API secrets live in `.env.local`, never committed
- API routes handle all external service calls — frontend never calls Jira directly
- UI text is in English
- Components use `"use client"` only when they need hooks or event handlers
- Shared request/response types live in `lib/types.ts` — imported by both API routes and components
- Async operation state uses a discriminated union (`AsyncStatus`) with four states: `idle | loading | success | error`
- `StatusIndicator` is a reusable component for showing operation progress (colored dot, spinner, checkmark, or cross)
