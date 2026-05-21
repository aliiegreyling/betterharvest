# ConnorTime — Product Brief

## Problem

Knowledge workers and freelancers lose billable time and productivity insight because tracking time manually is friction-heavy. Starting a stopwatch in a separate app, copying entries into a spreadsheet, and remembering what you worked on interrupts flow. ConnorTime removes that friction with a single-page tracker that lets users start and stop named time entries instantly, then review a running log of all sessions.

## Target User

- Freelancers and consultants who bill by the hour and need an audit trail.
- Developers or knowledge workers who want to understand where their time goes without adopting a heavyweight SaaS tool.
- Anyone who needs a lightweight, browser-based time logger that works offline and requires no account sign-up.

## Scope

### Must Have (v1.0)
- **Entry creation** — user provides a label/description and hits **Start**; a live timer begins immediately.
- **Stop control** — a **Stop** button ends the active entry and records duration.
- **Multiple entries** — any number of entries can be created sequentially (one active at a time).
- **Session log** — a persistent, scrollable list of all completed entries showing label, start time, end time, and duration.
- **Persistence** — entries survive a page refresh via `localStorage`.
- **Basic UX** — responsive single-page layout usable on desktop and mobile browsers.

### Nice to Have (post-v1)
- Edit or delete individual log entries.
- Export log to CSV.
- Daily/weekly summary totals.
- Multiple concurrent timers.

## Non-Goals

- **No user accounts or cloud sync** in v1 — all data stays local.
- **No billing or invoicing** — ConnorTime tracks time, not money.
- **No team or multi-user features** — single-user only.
- **No native mobile app** — web only.
- **No integrations** (Jira, GitHub, calendar) in v1.

## Success Criteria

| # | Criterion | Measure |
|---|-----------|---------|
| 1 | A user can start a named timer in under 5 seconds from page load. | Manual UX walkthrough passes. |
| 2 | Stopping an entry immediately records it in the log with correct duration. | Duration matches wall-clock time within ±1 s. |
| 3 | Completed entries persist across page refreshes. | Log survives hard-reload with all entries intact. |
| 4 | The interface is usable on a 375 px wide mobile screen without horizontal scroll. | Tested in Chrome DevTools at 375 px. |
| 5 | App loads and runs fully offline. | No network requests required after initial load. |
