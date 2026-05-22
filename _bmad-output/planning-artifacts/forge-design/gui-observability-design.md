# Forge GUI Observability Design

## Purpose

Add a local GUI that lets a user watch Forge turn an intent into a plan, phase execution, audit events, checkpoints, and generated app state without replacing the terminal workflow.

## Product Shape

The GUI should be a companion surface to `forge chat`, not a separate orchestration brain. The CLI remains the source of truth for routing, model selection, run state, and audit logs. The GUI reads the same run artifacts and sends controlled commands through a small Forge runtime API.

Primary user jobs:

- See what Forge understood from the request.
- Inspect which model is assigned to each phase before work starts.
- Watch phase progress, logs, costs, and checkpoints during a run.
- See an active phase progress meter that matches the terminal phase sequence.
- Pause before phases, add guidance, skip, abort, or resume.
- Open generated files and run preview commands for web apps.
- Watch a generated web app in an iframe using the app's own dev-server hot reload.

## Architecture

Recommended stack:

- Local web app served by Forge, e.g. `forge gui`.
- Node HTTP server plus Server-Sent Events for run updates.
- Small frontend app in `forge/src/gui/` using Vite + React or a minimal no-framework renderer.
- Existing `~/.forge/runs/<id>/plan.json`, `audit.jsonl`, and `checkpoints/*.json` remain canonical.
- Optional WebSocket later only if two-way interactive controls outgrow HTTP POST + SSE.

Core modules:

- `runtime/events.ts` emits structured events whenever the runner appends audit entries or saves checkpoints.
- `runtime/controller.ts` exposes start, plan-only, pause, resume, skip, abort, and phase-guidance operations.
- `gui/server.ts` serves assets and API endpoints.
- `gui/client/` renders the dashboard.

## Minimal API

```text
GET  /api/models
GET  /api/runs
GET  /api/runs/:id
GET  /api/runs/:id/events
GET  /api/runs/:id/checkpoints
POST /api/plan
POST /api/runs
POST /api/runs/:id/phase-decision
POST /api/runs/:id/abort
```

SSE stream:

```text
GET /api/runs/:id/stream
```

Event types should mirror the CLI's durable data:

- `run_created`
- `plan_written`
- `phase_start`
- `cli_output`
- `cli_call`
- `phase_end`
- `checkpoint_saved`
- `run_done`
- `run_error`

## UI Layout

First screen:

- Left rail: request capture, target directory, context budget, planning model, implementation model.
- Center: phase timeline with model badges and status.
- Right panel: selected phase detail, live output, checkpoint summary, costs.
- Bottom or secondary tab: generated app preview and file list.

Do not make this a marketing landing page. The first viewport should be the operational run dashboard.

## Implementation Plan

1. Normalize model metadata for machine consumption with `GET /api/models`. Done in initial GUI slice.
2. Extract runner status callbacks from `runForge` so CLI and GUI receive the same events. Done in initial GUI slice.
3. Add `forge gui` to launch the local server and print a dashboard URL. Done in initial GUI slice.
4. Build read-only run dashboard from existing plans, audit logs, and checkpoints. Done in initial GUI slice.
5. Add controlled run creation and phase decisions.
6. Add generated app preview integration for common web stacks. Initial version done: detects `package.json`, starts `dev`/`start`/`preview`, embeds the local URL, and relies on the framework dev server for hot reload.

## Key Decision

Use append-only run artifacts as the contract between CLI and GUI. This keeps terminal usage reliable, makes GUI refresh/replay simple, and avoids a second state model that can disagree with Forge.
