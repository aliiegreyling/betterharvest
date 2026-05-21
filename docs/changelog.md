# Changelog

Notable changes to Forge and the surrounding harness. Newest first.

## Unreleased — Documentation system + Serena memories (2026-05-21)

- Created top-level `README.md` with full repo overview and conventions.
- Created `docs/` knowledge base (this directory): overview, architecture, roadmap, changelog, contributing, plus Forge / BMAD / Serena / workflows subtrees.
- Added durable Serena memories under `.serena/memories/` covering project orientation, Forge subsystem, BMAD conventions, MCP/context model, and roadmap.

## Forge v0.3 — model-agnostic CLI adapter pattern + Codex routing (commit `a728bd8`)

- Added `forge/src/cli-adapters/` with `claude.ts`, `codex.ts`, `types.ts`, `index.ts`.
- Impl phase can route to Codex when available.

## Forge v0.2 — drop Anthropic SDK, route via CLIs (commit `73db895`)

- Removed `@anthropic-ai/sdk`.
- Shells out to the `claude` and `codex` CLIs the user is already authenticated to.

## Forge v0.1 — initial agentic CLI (commit `1795998`)

- TypeScript/Node 20 CLI named `forge`.
- Commands: `new`, `plan`, `resume`, `models`, `log`, `cost`, `runs`, `doctor`.
- Anthropic model registry (Haiku, Sonnet, Opus).
- Six-phase SDLC plan with per-phase routing and escalation ladder.
- Local file/shell tool surface for sub-agents.
- Run persistence under `~/.forge/runs/<id>/`.

## Context-aware harness slice (post-v0.3, merged on `main`)

Tracked in the brief addendum. Touches:

- `forge/src/project/context.ts`, `forge/src/project/commands.ts`
- `forge/src/mcp/registry.ts`
- `forge/src/bmad/artifacts.ts`
- `forge/src/cli.ts` (status / context / mcp / inspect / design / work, plus `--model`, `--context-budget`, `--bmad`)
- `forge/src/types.ts` (new project/MCP types)
- `forge/src/runner.ts`, `forge/src/agents/orchestrator.ts`, `forge/src/agents/router.ts`
- `_bmad-output/planning-artifacts/agent-cli-harness-brief-2026-05-21/` (brief + addendum + decision log)
- `_bmad-output/planning-artifacts/forge-context/project-context.md`
- `_bmad-output/planning-artifacts/forge-design/` (data-design.md, brownfield-work-design.md)

Verified via `npm run typecheck`, `npm run build`, and CLI smoke tests for `status`, `mcp list`, `mcp health`, `models`, `context refresh`, `design`, `work`.

## SDLC plan v1 (commit `af8a181`)

- Authored [`_bmad-output/planning-artifacts/agentic-build-system-plan.md`](../_bmad-output/planning-artifacts/agentic-build-system-plan.md) — the original product/architecture document for `forge`.
