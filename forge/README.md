# forge

Chat-first agentic SDLC CLI that builds or maintains projects from a prompt with BMAD-aware planning context, MCP discovery, human sign-off gates, and dynamic routing across Claude Code and OpenAI Codex CLI adapters.

Forge shells out to CLIs you are already authenticated with. It does not require application API keys in its own configuration.

## Prerequisites

- Node 20+
- [Claude Code](https://claude.com/claude-code) installed and authenticated (`claude --version` works)
- Optional: OpenAI Codex CLI for Codex-routed phases (`codex --version` works)

## Install

```bash
cd forge
npm install
npm run build
npm link
```

`npm link` is optional. Without it, run commands with `node dist/cli.js`.

## Chat Usage

Run Forge with no subcommand, or explicitly run `chat`, to start the interactive harness:

```bash
node dist/cli.js
node dist/cli.js chat
```

Plain text chats directly with the selected model, using compact project context and no edit/shell tool permissions. Slash commands invoke operational journeys:

```text
/help
/models
/set model sonnet
/request build a CLI todo in Python with SQLite
/plan --bmad
/new --target-dir todo --coder codex
/new "inventory app" --step
/new "inventory app" --plan-only
/design data "todo domain model"
/work "add authentication to the existing app"
/mcp health
/set debug true
/doctor
```

Use `/request <text>` to capture a project idea without spending model tokens. Use plain text or `/ask <message>` when you want a model response.

On startup, chat prints the high-value commands and the available model ids. The interactive `/new` journey also prompts for planning and development model choices; use `auto` to keep Forge's router-owned defaults.

`/new` is guided in chat. In an interactive terminal it asks for the project request, target directory, context budget, and run mode before starting agent work:

- `step` pauses before each phase so you can add phase-specific guidance, `/skip`, or `/abort`.
- `auto` runs all phases without additional prompts.
- `plan` classifies and prints the route only.
- `cancel` exits before any model work starts.

The default `/new` and `new` workflow is an SDLC team journey:

```text
BA requirements -> technical architecture -> UI/UX design -> architecture synthesis
-> stories -> development -> QA/testing -> local infrastructure -> review
```

Approval gates pause after BA, architecture synthesis, QA/testing, and local infrastructure. The approver can approve, request changes, or abort. Use `--no-approval-gates` only for local experiments.

Generated projects are always kept under `forge/forge-out/`, which is ignored by Git. If you do not pass a target directory, Forge creates one project folder per run at `forge/forge-out/<run-id>`. Relative target names such as `todo` are scoped to `forge/forge-out/todo`.

Use `/work` or `forge work` to iterate on an existing project:

```bash
node dist/cli.js work "add password reset to the auth flow"
node dist/cli.js work "tighten the dashboard mobile layout" --target-dir todo --dry-run
```

Work mode uses the same SDLC team and approval gates, but writes `docs/CHANGE_REQUEST.md`, updates existing design/test/infra artifacts, and tells the dev agent to modify only the requested scope. It refuses to execute if the target project directory does not exist.

## Diagnostics

Forge reports user-facing errors with next steps instead of raw stack traces by default. Enable verbose diagnostics while developing:

```bash
FORGE_DEBUG=1 node dist/cli.js
node dist/cli.js --verbose models
```

Inside chat, use:

```text
/set debug true
```

Verbose mode logs command start/end events, model adapter spawning details with long prompts redacted, timings, and stack traces for failed commands.

## Script Usage

Existing subcommands remain available for scripts and CI:

```bash
node dist/cli.js doctor
node dist/cli.js models
node dist/cli.js plan "build a CLI todo in Python"
node dist/cli.js new "build a CLI todo in Python" --target-dir todo
node dist/cli.js log <run-id>
node dist/cli.js cost <run-id>
node dist/cli.js runs
node dist/cli.js resume <run-id>
node dist/cli.js gui
```

`resume` continues from the first failed or missing checkpoint. If a run fails during development, it skips the completed BA/design/story phases and retries development with the existing plan.

Context and planning commands:

```bash
node dist/cli.js status
node dist/cli.js context refresh
node dist/cli.js mcp list
node dist/cli.js mcp health
node dist/cli.js inspect "auth flow"
node dist/cli.js design data "domain model"
node dist/cli.js work "add feature X to the existing app" --target-dir todo
```

Local GUI:

```bash
node dist/cli.js gui
node dist/cli.js gui --port 4546
```

The GUI is a local dashboard over Forge runs. It follows the same pipeline principles as the terminal: `Plan` maps to dry-run planning, `Run` maps to the full Forge phase pipeline, and all durable state still lands under `~/.forge/runs/<id>/`.

The dashboard shows phase progress, active-phase loading state, checkpoints, generated files, and a preview pane. For generated web apps, `Start preview` detects `package.json`, runs the app's `dev`, `start`, or `preview` script, and loads the local app URL in an iframe so framework hot reload can show changes while Forge is building.

Use the `Role Guides` upload controls to attach markdown prompt files to BA or QA before starting a run. Forge stores those files under the run metadata and injects them only into the matching phase prompt, so a QA prompt pack can guide test-case, API-test, or Playwright-test behavior without changing the rest of the pipeline.

Planning defaults to the terminal-safe router. Codex can still be selected for planning by enabling `Allow Codex planning`; otherwise Codex is best used as the implementation model. Long-running phases stream and persist CLI output into the run log so the implementation phase does not look idle while Codex is working.

If a model CLI hits a capacity, quota, session-token, or context-window limit, Forge automatically retries that step on the other provider. Codex falls back to Claude Sonnet or Opus depending on the phase; Claude falls back to Codex. For no-tool phases, Forge can use API-key fallback as the final step: set `OPENAI_API_KEY` for OpenAI Responses API or `ANTHROPIC_API_KEY` for Anthropic Messages API. Tool-enabled phases keep using local CLIs because they need file and shell access. Fallbacks are recorded in the live output and audit log.

Runs can be deleted from the dashboard run list. Deleting a run removes its `~/.forge/runs/<id>/` metadata and checkpoints, and also removes that run's generated project folder when it is safely inside `forge/forge-out/`.

After a run creates an app, use the `Continue Build` chat panel to request follow-up changes against that same target directory. Choose a model for the change request, send the message, and Forge will run the selected model inside the generated app with read/write/edit/shell permissions. The preview pane can stay open so framework hot reload shows the change when the app dev server supports it.

Useful routing flags:

```bash
node dist/cli.js plan "build a CLI todo app" --model sonnet --context-budget low --bmad --skip-doctor
node dist/cli.js new "build a CLI todo app" --coder codex --context-budget deep --bmad
```

## How It Works

1. **Chat shell** opens by default and keeps a short conversation history plus the latest captured project request.
2. **Direct chat** sends plain text to the selected model with compact project context and no tool permissions.
3. **Slash commands** dispatch project journeys such as `/plan`, `/new`, `/work`, `/design`, `/mcp`, and `/context`.
4. **Classifier** runs Claude Haiku for `/plan` and `/new` to tag the prompt with project type, complexity, estimated files, ambiguity, stack hints, and UI requirements.
5. **Orchestrator** builds the SDLC team plan: BA, technical architecture, UI/UX, architecture synthesis, stories, development, QA/testing, local infrastructure, and review. In work mode, prompts are scoped to an existing project change request.
6. **Router** assigns models per phase using deterministic rules, with `--model` for broad non-QA overrides and `--coder` for development-only overrides.
7. **CLI adapters** invoke Claude Code or Codex with phase-scoped tool permissions and the target directory as the working directory.
8. **Audit and checkpoints** write run metadata under `~/.forge/runs/<id>/`.
9. **GUI dashboard** reads the same run metadata and streams live events for GUI-started runs.

## BMAD, Serena, and MCP

Forge detects repository context and surfaces BMAD, Serena, MCP, and package-manager readiness without loading large project state into the model.

- BMAD planning artifacts can be emitted under `_bmad-output/planning-artifacts/` with `--bmad`, `context refresh`, `design`, and `work`.
- Serena is auto-detected from `.serena/project.yml` and `.serena/serena.sh`.
- MCP support currently covers registry discovery and health checks from `forge.mcp.json`, `.forge/mcp.json`, `.mcp.json`, and Serena auto-detection.
- Live MCP tool execution is planned as the next integration layer.

## Routing Policy

| Phase | Default | Notes |
| --- | --- | --- |
| classify | haiku | Always classifier-owned |
| ba | sonnet | Uses haiku for small scopes; opus for high ambiguity |
| tech_arch | opus | Technical system design |
| ux_design | sonnet | Uses opus for high ambiguity |
| arch_synthesis | opus | Final TDD and Mermaid diagrams |
| stories | sonnet | Uses haiku for small scopes |
| dev | codex when available, otherwise sonnet | Uses opus for XL complexity; can be overridden with `--coder` |
| qa | sonnet | Test cases plus happy-path and negative-flow tests |
| infra | sonnet | Uses opus for larger systems; local Aspire or Docker Compose only |
| review | sonnet | Final README and readiness pass |

## Run Artifacts

Each run writes to `~/.forge/runs/<id>/`:

- `plan.json` contains the routing plan.
- `audit.jsonl` is the append-only event log.
- `checkpoints/*.json` contains per-phase results.

Generated projects land under `forge/forge-out/`. The default target is `forge/forge-out/<run-id>`; named targets such as `--target-dir todo` land at `forge/forge-out/todo`.
