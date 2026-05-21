# Harvest Logger — Architecture & Integration Blueprint

## Overview

Harvest Logger is an Electron desktop application that bridges **GitHub Projects (V2)** and the **Harvest time-tracking API**. It fetches the current user's sprint issues from a GitHub Project board, displays them in a sidebar-style UI, and enables one-click time logging to Harvest with full issue-hierarchy context embedded in the time entry notes.

---

## System Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                        Electron App                                │
│                                                                   │
│  ┌────────────────┐    IPC (invoke/handle)    ┌────────────────┐  │
│  │   Renderer     │ ◄───────────────────────► │   Main Process │  │
│  │  (app.js)      │                           │   (main.js)    │  │
│  │                │                           │                │  │
│  │  UI + State    │                           │  Auth Layer    │  │
│  │  management    │                           │  GitHub GraphQL│  │
│  │                │                           │  Harvest REST  │  │
│  └────────────────┘                           │  Window Mgmt   │  │
│         ▲                                     └───────┬────────┘  │
│         │                                             │           │
│  ┌──────┴───────┐                                     │           │
│  │  preload.js  │ (contextBridge)                     │           │
│  └──────────────┘                                     │           │
└───────────────────────────────────────────────────────┼───────────┘
                                                        │
                              ┌──────────────────────────┼──────────────────┐
                              │                          │                  │
                              ▼                          ▼                  ▼
                    ┌──────────────┐          ┌──────────────┐    ┌──────────────┐
                    │  GitHub API  │          │ Harvest API  │    │    .env      │
                    │  (GraphQL)   │          │  (REST)      │    │  (secrets)   │
                    └──────────────┘          └──────────────┘    └──────────────┘
```

---

## Layer Breakdown

### 1. Main Process (`main.js`)

The Node.js backend of the Electron app. Responsible for:

| Responsibility | Details |
|---|---|
| **Authentication** | Reads `GITHUB_TOKEN` from `.env`, or falls back to `gh auth token` CLI |
| **GitHub GraphQL** | Single reusable function `githubGraphQL(query, variables)` for all GitHub data |
| **Harvest REST** | Single reusable function `harvestPost(endpoint, body)` for Harvest API calls |
| **IPC Handlers** | Exposes named channels: `get-config`, `fetch-issues`, `fetch-sub-issues`, `log-time`, window controls |
| **Window Management** | Frameless, resizable, pin-on-top sidebar window |
| **Environment Config** | Loads `.env` relative to exe (packaged) or project root (dev) |

### 2. Preload Script (`preload.js`)

A thin security bridge using Electron's `contextBridge`. Exposes a safe `window.api` object to the renderer with only the allowed IPC channels:

```javascript
window.api = {
  getConfig()              // → { username, org, projectNum, hasHarvest }
  fetchIssues()            // → { issues[], projectTitle, sprint }
  fetchSubIssues(params)   // → subIssue[]
  logTime(data)            // → Harvest time entry response
  togglePin()              // → boolean (new pin state)
  minimizeWindow()
  closeWindow()
  openUrl(url)
}
```

### 3. Renderer (`renderer/app.js` + `index.html` + `style.css`)

A vanilla JS single-page app (no framework) managing views:

| View | Purpose |
|---|---|
| `view-loading` | Spinner while fetching |
| `view-error` | Error display with retry |
| `view-list` | Issue cards for the current sprint |
| `view-detail` | Issue detail, sub-issue navigation, and time log form |
| `session-summary` | Running total of logged hours in the session |

---

## Data Flow

```
1. App starts → main.js creates BrowserWindow → loads index.html
2. Renderer calls window.api.fetchIssues()
3. Main process runs GitHub GraphQL query against ProjectV2
4. Query filters: OPEN issues, assigned to user, in current sprint, not "Done"
5. Returns structured issue objects with metadata (labels, priority, client, sub-issues)
6. User selects an issue → drills into sub-issues → selects log target
7. User fills hours/date/notes → calls window.api.logTime()
8. Main process builds structured notes string:
     TASK: #parent > #child > #leaf
     DETAIL: (issue body excerpt)
     UPDATES: (user notes)
9. POSTs to Harvest /v2/time_entries with project_id, task_id, spent_date, hours, notes
```

---

## Configuration (`.env` file)

```env
# GitHub
GITHUB_TOKEN=ghp_xxxxxxxxxxxx          # or rely on `gh auth token`
GITHUB_USERNAME=your-username           # filters issues assigned to you
GITHUB_ORG=YourOrg                      # GitHub organization
GITHUB_PROJECT_NUM=8                    # ProjectV2 number

# Harvest
HARVEST_TOKEN=xxxxxxxx                  # Harvest personal access token
HARVEST_ACCOUNT_ID=1234567              # Harvest account ID
HARVEST_PROJECT_ID=99999999             # Target project for time entries
HARVEST_TASK_ID=88888888                # Target task within the project
```

---

## Core Functions (Extractable for Integration)

### `githubGraphQL(query, variables)`

Generic GitHub GraphQL executor. Requires a Bearer token.

```javascript
async function githubGraphQL(query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'your-app/1.0'
    },
    body: JSON.stringify({ query, variables })
  })
  const data = await res.json()
  if (data.errors) throw new Error(data.errors[0].message)
  return data.data
}
```

### `harvestPost(endpoint, body)`

Generic Harvest API POST. Requires Bearer token + Account ID.

```javascript
async function harvestPost(endpoint, body) {
  const res = await fetch(`https://api.harvestapp.com${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Harvest-Account-Id': accountId,
      'Content-Type': 'application/json',
      'User-Agent': 'your-app/1.0'
    },
    body: JSON.stringify(body)
  })
  return { status: res.status, data: await res.json() }
}
```

### `logTime({ hours, date, notes, issueHierarchy })`

The main business logic function. Builds a structured note from the issue hierarchy and posts to Harvest.

```javascript
async function logTime({ hours, date, notes, issueHierarchy }) {
  const taskPath = issueHierarchy
    .map(i => `#${i.number} ${cleanText(i.title)}`)
    .join(' > ')

  const leaf = issueHierarchy[issueHierarchy.length - 1]
  const detail = cleanText(leaf?.body || '').substring(0, 500)

  let harvestNotes = `TASK: ${taskPath}`
  if (detail) harvestNotes += `\nDETAIL: ${detail}`
  if (notes) harvestNotes += `\nUPDATES: ${notes}`

  return harvestPost('/v2/time_entries', {
    project_id: projectId,
    task_id: taskId,
    spent_date: date,
    hours: parseFloat(hours),
    notes: harvestNotes
  })
}
```

---

## Integration Blueprint: Using Harvest Logger as a Function in Another System

### Strategy 1: Extract as a Node.js Module

Strip the Electron shell and expose the core logic as an importable module.

**File structure:**

```
harvest-logger-core/
├── index.js          # exports: fetchSprintIssues, logTimeToHarvest
├── github.js         # githubGraphQL + issue-fetching query
├── harvest.js        # harvestPost + logTime logic
├── config.js         # env loading & validation
└── package.json
```

**Usage:**

```javascript
const { fetchSprintIssues, logTimeToHarvest } = require('./harvest-logger-core')

// Fetch current sprint issues for a user
const { issues } = await fetchSprintIssues({
  token: process.env.GITHUB_TOKEN,
  org: 'YourOrg',
  projectNum: 8,
  username: 'youruser'
})

// Log time against an issue hierarchy
await logTimeToHarvest({
  harvestToken: process.env.HARVEST_TOKEN,
  accountId: process.env.HARVEST_ACCOUNT_ID,
  projectId: process.env.HARVEST_PROJECT_ID,
  taskId: process.env.HARVEST_TASK_ID,
  hours: 1.5,
  date: '2026-05-21',
  notes: 'Implemented feature X',
  issueHierarchy: [
    { number: 42, title: 'Epic: Auth System', body: '' },
    { number: 87, title: 'Add OAuth flow', body: 'Implement...' }
  ]
})
```

---

### Strategy 2: Expose as a REST/HTTP Microservice

Wrap the core functions in an Express/Fastify server.

```javascript
const express = require('express')
const app = express()
app.use(express.json())

app.get('/api/issues', async (req, res) => {
  const issues = await fetchSprintIssues(config)
  res.json(issues)
})

app.post('/api/log-time', async (req, res) => {
  const result = await logTimeToHarvest({ ...config, ...req.body })
  res.json(result)
})

app.listen(3000)
```

---

### Strategy 3: Use as a Tool/Function in an AI Agent System

Register `logTime` and `fetchIssues` as callable tools/functions.

**Tool Definition (OpenAI function-calling format):**

```json
{
  "name": "log_time_to_harvest",
  "description": "Log hours worked to Harvest time tracker against a GitHub issue hierarchy",
  "parameters": {
    "type": "object",
    "properties": {
      "hours": { "type": "number", "description": "Hours to log (e.g. 1.5)" },
      "date": { "type": "string", "description": "Date in YYYY-MM-DD format" },
      "notes": { "type": "string", "description": "Work description / updates" },
      "issueHierarchy": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "number": { "type": "integer" },
            "title": { "type": "string" },
            "body": { "type": "string" }
          }
        },
        "description": "Issue chain from parent to leaf (task worked on)"
      }
    },
    "required": ["hours", "date", "issueHierarchy"]
  }
}
```

**Tool Definition (fetch sprint issues):**

```json
{
  "name": "fetch_sprint_issues",
  "description": "Get all open GitHub issues assigned to the user in the current sprint",
  "parameters": {
    "type": "object",
    "properties": {
      "username": { "type": "string", "description": "GitHub username to filter by" }
    }
  }
}
```

**Handler implementation:**

```javascript
async function handleToolCall(toolName, args) {
  switch (toolName) {
    case 'fetch_sprint_issues':
      return fetchSprintIssues({ ...config, username: args.username })

    case 'log_time_to_harvest':
      return logTimeToHarvest({
        ...config,
        hours: args.hours,
        date: args.date,
        notes: args.notes || '',
        issueHierarchy: args.issueHierarchy
      })
  }
}
```

---

### Strategy 4: MCP (Model Context Protocol) Server

Package as an MCP tool server for use with AI coding agents.

```javascript
// mcp-harvest-server/index.js
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const server = new McpServer({ name: 'harvest-logger', version: '1.0.0' })

server.tool('fetch_sprint_issues', { username: z.string().optional() }, async ({ username }) => {
  const result = await fetchSprintIssues({ ...config, username })
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
})

server.tool('log_time', {
  hours: z.number(),
  date: z.string(),
  notes: z.string().optional(),
  issueHierarchy: z.array(z.object({
    number: z.number(),
    title: z.string(),
    body: z.string().optional()
  }))
}, async (args) => {
  const result = await logTimeToHarvest({ ...config, ...args })
  return { content: [{ type: 'text', text: `Logged ${args.hours}h successfully` }] }
})
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **GraphQL over REST** | GitHub's ProjectV2 fields (Sprint, Status, Priority, Client) are only accessible via GraphQL |
| **Issue hierarchy in notes** | Creates audit trail: Harvest entries trace back to exact sub-task |
| **No database** | Stateless per-session design; GitHub is the source of truth |
| **Frameless window** | Sidebar UX — docks to screen edge, minimal distraction |
| **contextIsolation: true** | Security best practice; renderer has zero direct Node access |
| **`gh auth token` fallback** | Users with GitHub CLI don't need to manage separate tokens |
| **Sprint date filtering** | Only shows issues in the active sprint iteration, auto-excluding past/future work |

---

## GraphQL Query Structure (The Core Data Model)

The main query fetches from `organization → projectV2 → items` and extracts:

```
Issue
├── number, title, body, state, url
├── repository { name, owner }
├── assignees[]
├── labels[]
├── parent (excluded — only top-level issues shown)
├── subIssues[] (recursive)
│   ├── number, title, body, state
│   ├── repository { name, owner }
│   ├── labels[]
│   └── subIssues.totalCount (for drill-down indicator)
└── Project Fields (via fieldValueByName)
    ├── Sprint (iterationId, title, startDate, duration)
    ├── Status (name)
    ├── Priority (name)
    └── Client (name)
```

---

## Filtering Logic

Issues are displayed only if ALL conditions are met:

1. Has a valid `content.number` (is an Issue, not a Draft)
2. State is `OPEN`
3. Has no parent issue (top-level only; sub-issues shown via drill-down)
4. Assigned to configured `GITHUB_USERNAME`
5. Status is not `Done`
6. Sprint date range includes today

---

## Step-by-Step: Integrating into Your System

### Prerequisites

- Node.js 18+
- GitHub personal access token (or `gh` CLI authenticated)
- Harvest personal access token + account ID
- A Harvest project & task ID to log against

### Steps

1. **Copy the core functions** (`githubGraphQL`, `harvestPost`, `logTime`, the GraphQL query) into your project.

2. **Install dependencies:**
   ```bash
   npm install dotenv
   ```

3. **Set up your `.env`** with the required tokens and IDs (see Configuration section above).

4. **Wire up `fetchSprintIssues()`** to get the issue list. This returns an array of issue objects with the shape:
   ```typescript
   interface Issue {
     number: number
     title: string
     body: string
     url: string
     repo: { name: string; owner: string }
     labels: { name: string; color: string }[]
     status: string
     priority: string
     client: string
     sprint: string
     hasSubIssues: boolean
     subIssues: SubIssue[]
   }
   ```

5. **Wire up `logTimeToHarvest()`** passing:
   - `hours` — decimal hours
   - `date` — ISO date string (YYYY-MM-DD)
   - `notes` — optional user-provided context
   - `issueHierarchy` — array from parent→leaf of issues being logged against

6. **Handle errors** — both functions throw on auth failure or API errors.

7. **Optional: Add `fetchSubIssues()`** for recursive drill-down into nested issues.

---

## Security Notes

- Tokens are loaded from `.env` only — never hardcoded
- Content Security Policy set in HTML (no inline scripts, no external loads)
- `contextIsolation: true` + `nodeIntegration: false` in Electron
- User input is HTML-escaped in the renderer via the `esc()` helper
- Harvest notes are sanitized with `cleanText()` (strips markdown, non-ASCII)

---

## File Reference

| File | Role |
|---|---|
| `main.js` | Electron main process — auth, API calls, IPC handlers, window setup |
| `preload.js` | Security bridge — exposes `window.api` to renderer |
| `renderer/index.html` | Shell HTML with view containers |
| `renderer/app.js` | UI logic — state management, DOM rendering, event handling |
| `renderer/style.css` | Catppuccin-themed dark UI |
| `package.json` | Electron + electron-builder config |
| `.env` | Runtime secrets (not committed) |
| `build-icon.js` | Dev utility — converts PNG icon to ICO |
| `start.bat` | Quick-launch script for Windows dev |
