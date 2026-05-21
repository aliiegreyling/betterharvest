# Forge

Headless agentic CLI that builds and maintains projects from a single prompt. No API keys required — Forge shells out to the `claude` and `codex` CLIs you're already authenticated to.

## Pages

- [cli-reference.md](cli-reference.md) — every command and flag
- [architecture.md](architecture.md) — internal architecture
- [routing-and-models.md](routing-and-models.md) — model registry and per-phase policy
- [runs-and-audit.md](runs-and-audit.md) — run state, audit log, cost reporting
- [context-and-mcp.md](context-and-mcp.md) — project context detection and MCP servers

## Source-of-truth code

- Package: [forge/](../../forge/)
- README in the package: [forge/README.md](../../forge/README.md)

## At a glance

| Aspect | Detail |
| --- | --- |
| Language | TypeScript (Node 20+, ES modules) |
| Entry | [forge/src/cli.ts](../../forge/src/cli.ts) |
| Build | `npm run build` → `forge/dist/cli.js` |
| CLI auth | Uses the local `claude` and `codex` binaries; no API keys |
| Models | Haiku, Sonnet, Opus, Codex (via the underlying CLIs) |
| Run state | `~/.forge/runs/<id>/` (or `$FORGE_HOME`) |
| Planning artifacts | `_bmad-output/planning-artifacts/` (when `--bmad` or `forge context refresh`/`design`/`work`) |
| Current version | v0.3 + context-aware harness slice |

## Mental model

1. You give Forge a prompt or a brownfield request.
2. Haiku classifies it into `{project_type, complexity, est_files, requires_ui, stack_hint, ambiguity_score}`.
3. The orchestrator builds a six-phase plan (`brief → arch → stories → impl → verify → review`). Each node has a routed model.
4. The sub-agent runner shells the chosen CLI for each phase, with phase-scoped allowed tools and the target dir as cwd.
5. On failure, the runner escalates one rung up the model ladder.
6. Every CLI call appends a JSONL event with duration, exit code, tokens, cost.

The whole system is intentionally thin — the real tool loop lives inside `claude` / `codex`. Forge picks the model and scopes the work.
