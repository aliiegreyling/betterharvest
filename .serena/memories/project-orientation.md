# Project orientation

## What this repo is

**betterharvest** is the workspace for building the **Agentic Workflow CLI Harness** — a context-aware CLI that combines BMAD Method (workflow), Serena MCP (semantic code intelligence), and Forge (the CLI implementation under `forge/`).

Repo URL: github.com/aliiegreyling/betterharvest. Maintainer: Connor Cress.

## The three layers

1. **BMAD Method v6.7.1** — owns the SDLC sequence (brief → PRD → arch → epics → stories → delivery). Skills installed at `.claude/skills/` and `.agents/skills/`.
2. **Serena MCP** — semantic code intelligence. Configured in `.serena/project.yml` (TypeScript + C# enabled). Launched via `.serena/serena.sh`.
3. **Forge** (`forge/`) — the active product. A headless TypeScript/Node CLI that shells out to the `claude` and `codex` CLIs (no API keys) with per-phase model routing.

## Where to start any session

1. Read top-level `README.md` and `docs/README.md` first.
2. `forge status` to detect Git/BMAD/Serena/MCP context.
3. For planning, invoke `bmad-help` skill.
4. For coding on Forge, see `docs/forge/architecture.md` and `docs/contributing.md`.

## Current version & state

- Forge v0.3 + context-aware harness slice merged to `main`.
- v0.4 priorities: live MCP client, Serena tool calls, brownfield execution, approval/risk policy.
- See `docs/roadmap.md` and `docs/changelog.md` for specifics.

## Source-of-truth product docs

- Brief: `_bmad-output/planning-artifacts/agent-cli-harness-brief-2026-05-21/brief.md`
- Original SDLC plan: `_bmad-output/planning-artifacts/agentic-build-system-plan.md`
- Addendum (Forge baseline analysis + v0.2 implementation summary): same dir, `addendum.md`
