# forge

Headless agentic CLI that builds projects from a single prompt — **no API keys**. Forge orchestrates SDLC phases and shells out to the `claude` (Claude Code) and `codex` (OpenAI Codex CLI) binaries you're already logged into. Per-phase **dynamic model routing** across Haiku / Sonnet / Opus / Codex.

## Prerequisites

- Node 20+
- [Claude Code](https://claude.com/claude-code) installed and authenticated (`claude --version` works)
- Optional: [OpenAI Codex CLI](https://github.com/openai/codex) for Codex-routed phases (`codex --version` works)

No `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` needed in forge itself — auth comes from the CLIs you already use.

## Install

```bash
cd forge
npm install
npm run build
```

## Usage

```bash
node dist/cli.js doctor                          # verify CLIs are installed
node dist/cli.js models                          # list model registry
node dist/cli.js plan "build a CLI todo in Python"   # dry-run, print plan only
node dist/cli.js new  "build a CLI todo in Python" --target-dir ../forge-out
node dist/cli.js log  <run-id>                   # audit log
node dist/cli.js cost <run-id>                   # per-model cost (when CLI reports it)
node dist/cli.js runs                            # recent runs
node dist/cli.js resume <run-id> --target-dir ../forge-out
```

## How it works

1. **Classifier** (`claude -p --model haiku --output-format json`) tags the prompt with project type, complexity, estimated files, ambiguity.
2. **Orchestrator** builds a 6-phase plan: brief → arch → stories → impl → verify → review. Each phase node is routed to a model by a deterministic policy (with overrides for complexity/ambiguity).
3. **Sub-agent runner** shells the chosen CLI with phase-scoped `--allowedTools` and the target directory as cwd. Claude Code runs its own native tool loop inside.
4. **Escalation:** if a phase fails (non-zero exit), the runner retries with the next model up the ladder (haiku → sonnet → opus). Impl phase has escalation enabled by default.
5. **Audit:** every CLI call writes a JSONL event to `~/.forge/runs/<id>/audit.jsonl` with duration, exit code, and (when reported by the CLI) tokens + USD cost.

See [the SDLC plan](../_bmad-output/planning-artifacts/agentic-build-system-plan.md) for the full architecture.

## Routing policy (v0.2)

| Phase | Default | Notes |
|---|---|---|
| classify | haiku | always |
| brief | sonnet | → haiku if complexity=S; → opus if ambiguity > 0.7 |
| arch | opus | → opus regardless |
| stories | sonnet | → haiku if complexity=S |
| impl | sonnet | → opus if complexity=XL; escalates on failure |
| verify | sonnet | |
| review | sonnet | |

Override the plan by editing `~/.forge/runs/<id>/plan.json` and re-running with `resume`.

## Run artifacts

Each run writes to `~/.forge/runs/<id>/`:
- `plan.json` — the routing plan
- `audit.jsonl` — append-only event log
- `checkpoints/*.json` — per-phase results

The generated project lands in `--target-dir`.
