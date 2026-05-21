# forge

Headless agentic CLI that builds or maintains projects from a prompt with BMAD-aware planning context, MCP discovery, and dynamic routing across Claude Code and OpenAI Codex CLI adapters.

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

## Usage

```bash
node dist/cli.js doctor
node dist/cli.js models
node dist/cli.js plan "build a CLI todo in Python"
node dist/cli.js new "build a CLI todo in Python" --target-dir ../forge-out
node dist/cli.js log <run-id>
node dist/cli.js cost <run-id>
node dist/cli.js runs
node dist/cli.js resume <run-id> --target-dir ../forge-out
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

Useful routing flags:

```bash
node dist/cli.js plan "build a CLI todo app" --model sonnet --context-budget low --bmad --skip-doctor
node dist/cli.js new "build a CLI todo app" --coder codex --context-budget deep --bmad
```

## How It Works

1. **Classifier** runs Claude Haiku to tag the prompt with project type, complexity, estimated files, ambiguity, stack hints, and UI requirements.
2. **Orchestrator** builds a 6-phase plan: brief, architecture, stories, implementation, verification, and review.
3. **Router** assigns models per phase using deterministic rules, with `--model` for broad non-verification overrides and `--coder` for implementation-only overrides.
4. **CLI adapters** invoke Claude Code or Codex with phase-scoped tool permissions and the target directory as the working directory.
5. **Audit and checkpoints** write run metadata under `~/.forge/runs/<id>/`.

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
