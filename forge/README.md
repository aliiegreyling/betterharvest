# forge

Chat-first agentic CLI that builds or maintains projects from a prompt with BMAD-aware planning context, MCP discovery, and dynamic routing across Claude Code and OpenAI Codex CLI adapters.

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
/new --target-dir ../todo --coder codex
/new "inventory app" --step
/new "inventory app" --plan-only
/design data "todo domain model"
/work "add authentication to the existing app"
/mcp health
/set debug true
/doctor
```

Use `/request <text>` to capture a project idea without spending model tokens. Use plain text or `/ask <message>` when you want a model response.

On startup, chat prints the high-value commands and the available model ids. The interactive `/new` journey also prompts for planning and implementation model choices; use `auto` to keep Forge's router-owned defaults.

`/new` is guided in chat. In an interactive terminal it asks for the project request, target directory, context budget, and run mode before starting agent work:

- `step` pauses before each phase so you can add phase-specific guidance, `/skip`, or `/abort`.
- `auto` runs all phases without additional prompts.
- `plan` classifies and prints the route only.
- `cancel` exits before any model work starts.

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
node dist/cli.js new "build a CLI todo in Python" --target-dir ../forge-out
node dist/cli.js log <run-id>
node dist/cli.js cost <run-id>
node dist/cli.js runs
node dist/cli.js resume <run-id> --target-dir ../forge-out
node dist/cli.js gui
```

Context and planning commands:

```bash
node dist/cli.js status
node dist/cli.js context refresh
node dist/cli.js mcp list
node dist/cli.js mcp health
node dist/cli.js inspect "auth flow"
node dist/cli.js design data "domain model"
node dist/cli.js work "add feature X"
```

Local GUI:

```bash
node dist/cli.js gui
node dist/cli.js gui --port 4546
```

The GUI is a local dashboard over Forge runs. It follows the same pipeline principles as the terminal: `Plan` maps to dry-run planning, `Run` maps to the full Forge phase pipeline, and all durable state still lands under `~/.forge/runs/<id>/`.

The dashboard shows phase progress, active-phase loading state, checkpoints, generated files, and a preview pane. For generated web apps, `Start preview` detects `package.json`, runs the app's `dev`, `start`, or `preview` script, and loads the local app URL in an iframe so framework hot reload can show changes while Forge is building.

Useful routing flags:

```bash
node dist/cli.js plan "build a CLI todo app" --model sonnet --context-budget low --bmad --skip-doctor
node dist/cli.js new "build a CLI todo app" --coder codex --context-budget deep --bmad
```

## How It Works

1. **Chat shell** opens by default and keeps a short conversation history plus the latest captured project request.
2. **Direct chat** sends plain text to the selected model with compact project context and no tool permissions.
3. **Slash commands** dispatch project journeys such as `/plan`, `/new`, `/design`, `/work`, `/mcp`, and `/context`.
4. **Classifier** runs Claude Haiku for `/plan` and `/new` to tag the prompt with project type, complexity, estimated files, ambiguity, stack hints, and UI requirements.
5. **Orchestrator** builds a 6-phase plan: brief, architecture, stories, implementation, verification, and review.
6. **Router** assigns models per phase using deterministic rules, with `--model` for broad non-verification overrides and `--coder` for implementation-only overrides.
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
| brief | sonnet | Uses haiku for small scopes; opus for high ambiguity |
| arch | opus | Architecture-heavy by default |
| stories | sonnet | Uses haiku for small scopes |
| impl | sonnet | Uses opus for XL complexity; can be overridden with `--coder` |
| verify | sonnet | Verification ignores broad `--model` overrides |
| review | sonnet | Final review and documentation pass |

## Run Artifacts

Each run writes to `~/.forge/runs/<id>/`:

- `plan.json` contains the routing plan.
- `audit.jsonl` is the append-only event log.
- `checkpoints/*.json` contains per-phase results.

Generated projects land in `--target-dir`.
