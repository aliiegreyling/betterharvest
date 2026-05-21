# Forge CLI commands

Source: `forge/src/cli.ts`. Version `0.3.0`.

## Build & plan

- `forge new <prompt>` — build a project. Flags: `--target-dir <dir>` (default `./forge-out`), `--coder <model>`, `--model <id>`, `--context-budget low|standard|deep` (default `standard`), `--bmad`, `--dry-run`, `--skip-doctor`.
- `forge plan <prompt>` — dry-run plan only. Same flags as `new` minus `--dry-run`.
- `forge resume <run-id>` — re-run from saved plan. Flag: `--target-dir <dir>`.

## Environment & context

- `forge doctor` — verify `claude` (required) and `codex` (optional) CLIs.
- `forge status` — project context + MCP servers + health.
- `forge context [show|refresh]` — `show` prints status; `refresh` writes portable artifact to `_bmad-output/planning-artifacts/forge-context/project-context.md`.
- `forge mcp list` — list discovered MCP servers.
- `forge mcp health` — validate each server's configuration.

## Brownfield & design

- `forge inspect <topic>` — project context + Serena availability note (live semantic lookup is v0.4).
- `forge design <domain> <prompt>` — write BMAD scaffold-domain artifact under `_bmad-output/planning-artifacts/forge-design/<domain>-design.md`. Convention: `data | ux | backend | infra | frontend | deployment`.
- `forge work <request>` — write a brownfield work-plan artifact.

## Introspection

- `forge models` — model registry.
- `forge runs` — last 20 runs with prompt snippet.
- `forge log <run-id>` — every audit event.
- `forge cost <run-id>` — per-model cost aggregate (CLI-reported; Codex usually $0).

## Key flag semantics

- `--model <id>` applies to every phase **except** `verify`.
- `--coder <model>` applies **only** to `impl`.
- `--bmad` mirrors `plan.json` + `plan.md` into `_bmad-output/planning-artifacts/forge-runs/<id>/`.
- `--context-budget` accepted values: `low | standard | deep`. Invalid value → process exits 1.
- `--skip-doctor` bypasses CLI availability check (useful in CI / tests).
