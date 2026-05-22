# Forge CLI Reference

Source: [forge/src/cli.ts](../../forge/src/cli.ts). Version: `0.3.0`.

## Conventions

- Binary: `node dist/cli.js <command>` (or `forge <command>` once linked via `npm link` / package bin).
- `--skip-doctor` skips CLI availability checks (`new`, `plan`).
- `--bmad` mirrors the run plan into `_bmad-output/planning-artifacts/forge-runs/<run-id>/`.
- `--context-budget low|standard|deep` adjusts per-phase context budgeting (default `standard`).
- `--model <id>` overrides the model for non-verification phases.
- `--coder <model>` overrides specifically the impl phase (e.g. `codex`, `opus`).

## Commands

### Chat

#### `forge` / `forge chat`
Start the chat-first harness. On startup, Forge shows the high-value slash commands plus the available model ids.

Plain text chats with the selected model and captures the text as the current request. Operational work is driven by slash commands:

| Command | Purpose |
| --- | --- |
| `/help` | Show the full command list |
| `/models` | Show model registry details |
| `/set model <id\|auto>` | Set or clear the chat model override |
| `/set coder <id\|auto>` | Set or clear the implementation model override |
| `/request <text>` | Capture an app/project request without calling a model |
| `/plan [prompt]` | Build a dry-run routing plan |
| `/new [prompt]` | Start the guided project journey |

During guided `/new`, Forge prompts for request, target directory, context budget, planning model, implementation model, and run mode. Use `auto` for model prompts to keep the deterministic router in control.

### Build & plan

#### `forge new <prompt>`
Build a new project from a natural-language prompt.

| Flag | Default | Purpose |
| --- | --- | --- |
| `--target-dir <dir>` | `./forge-out` | Where the generated project lands |
| `--coder <model>` | — | Override impl-phase model |
| `--model <id>` | — | Override non-verify phases |
| `--context-budget <low\|standard\|deep>` | `standard` | Context budget mode |
| `--bmad` | off | Also write plan to `_bmad-output/.../forge-runs/<id>/` |
| `--dry-run` | off | Print plan only, no execution |
| `--skip-doctor` | off | Skip `claude`/`codex` availability check |

#### `forge plan <prompt>`
Print the routing plan without executing. Same flags as `new` except always dry-run.

#### `forge resume <run-id>`
Resume a saved run plan from `~/.forge/runs/<id>/plan.json`.

| Flag | Default | Purpose |
| --- | --- | --- |
| `--target-dir <dir>` | `./forge-out` | Where the project lives |

### Environment & context

#### `forge doctor`
Verify required (`claude`) and optional (`codex`) CLIs are installed.

#### `forge status`
Print project context (Git, branch, BMAD, Serena, Forge, package manager) plus discovered MCP servers and their health.

#### `forge context [show|refresh]`
- `show` (default) — same as `status` text.
- `refresh` — write a portable status artifact to `_bmad-output/planning-artifacts/forge-context/project-context.md`.

#### `forge mcp list`
List discovered MCP servers: name, type, enabled, risk, endpoint, source.

#### `forge mcp health`
Validate each discovered MCP server's configuration (command path exists, URL set, etc.).

### Brownfield & design

#### `forge inspect <topic>`
Print project context for a topic and indicate whether Serena semantic lookup is available. Live Serena tool calls are roadmap (v0.4).

#### `forge design <domain> <prompt>`
Write a BMAD scaffold-domain design artifact to `_bmad-output/planning-artifacts/forge-design/<domain>-design.md`. `<domain>` is free-text but the convention is one of `data | ux | backend | infra | frontend | deployment`.

#### `forge work <request>`
Create a brownfield work-plan artifact (currently a scaffold; the work-plan is the artifact, execution is roadmap).

### Introspection

#### `forge models`
List the model registry with `{id, cli, cliModelFlag, strengths, notes}`.

#### `forge gui`
Start the local Forge dashboard.

| Flag | Default | Purpose |
| --- | --- | --- |
| `--host <host>` | `127.0.0.1` | Host/interface to bind |
| `--port <port>` | `4545` | Local dashboard port |

The dashboard reads `~/.forge/runs/<id>/plan.json`, `audit.jsonl`, and checkpoints so it can observe terminal-launched runs. Runs started from the dashboard stream live events over Server-Sent Events.

GUI controls intentionally mirror terminal concepts:

| GUI Control | Terminal equivalent |
| --- | --- |
| `Plan` | `forge plan ...` / dry-run routing plan |
| `Run` | `forge new ...` / full phase pipeline |
| Planning model | `--model <id>` |
| Impl model | `--coder <id>` |
| Context | `--context-budget <mode>` |

The dashboard also includes a phase progress meter and app preview. `Start preview` detects the selected run's target directory, looks for `package.json`, runs the first available `dev`, `start`, or `preview` script, and embeds the local URL in the preview frame.

#### `forge runs`
List up to 20 most recent runs with prompt snippet.

#### `forge log <run-id>`
Print every event from `~/.forge/runs/<run-id>/audit.jsonl`: timestamp, kind, node, model, duration, tokens, cost, message.

#### `forge cost <run-id>`
Aggregate cost per model for a run, from CLI-reported usage. Codex CLI typically does not report cost.

## Exit codes

- `0` — success.
- `1` — run failure or invalid input (e.g. unknown model, unknown context-budget value).

## Environment variables

| Var | Purpose |
| --- | --- |
| `FORGE_HOME` | Override `~/.forge/` run state root |
| (others) | None — auth lives in the `claude` and `codex` CLIs |
