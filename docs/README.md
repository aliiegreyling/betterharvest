# Documentation Index

Durable knowledge for the **betterharvest** workspace. Planning artifacts live in [`_bmad-output/planning-artifacts/`](../_bmad-output/planning-artifacts/); this directory holds the long-lived reference material.

## Start here

- [overview.md](overview.md) — what we're building, the problem, the solution
- [architecture.md](architecture.md) — how BMAD + Serena + Forge compose
- [roadmap.md](roadmap.md) — shipped vs. next
- [changelog.md](changelog.md) — Forge versions and notable changes
- [contributing.md](contributing.md) — how to add code, docs, and planning artifacts

## Forge (the CLI we're building)

- [forge/README.md](forge/README.md) — Forge subsystem overview
- [forge/cli-reference.md](forge/cli-reference.md) — every command, every flag
- [forge/routing-and-models.md](forge/routing-and-models.md) — model registry and per-phase routing policy
- [forge/runs-and-audit.md](forge/runs-and-audit.md) — run persistence, audit log, cost reporting
- [forge/context-and-mcp.md](forge/context-and-mcp.md) — project context detection and MCP registry
- [forge/architecture.md](forge/architecture.md) — internal architecture (orchestrator → router → sub-agent → adapters)

## BMAD

- [bmad/README.md](bmad/README.md) — installed modules, planning flow, where artifacts go
- [bmad/skills-reference.md](bmad/skills-reference.md) — most-used BMAD skills in this repo

## Serena

- [serena/README.md](serena/README.md) — project config, launchers, MCP exposure
- [serena/memories.md](serena/memories.md) — memory conventions for this project

## Workflows

- [workflows/greenfield.md](workflows/greenfield.md) — idea → shipped greenfield project
- [workflows/brownfield.md](workflows/brownfield.md) — modify this repo or another existing one
- [workflows/adding-a-forge-command.md](workflows/adding-a-forge-command.md) — concrete recipe

## Where things live (cheat sheet)

| Kind | Location |
| --- | --- |
| Product briefs, PRDs, architecture docs | `_bmad-output/planning-artifacts/<topic>/` |
| Forge run state (per-machine) | `~/.forge/runs/<id>/` (or `$FORGE_HOME`) |
| Forge plan artifacts (when `--bmad`) | `_bmad-output/planning-artifacts/forge-runs/<id>/` |
| Forge context snapshots | `_bmad-output/planning-artifacts/forge-context/` |
| Forge design artifacts | `_bmad-output/planning-artifacts/forge-design/` |
| Reference docs (this dir) | `docs/` |
| Serena memories | `.serena/memories/` |
| BMAD framework files | `_bmad/` |
| BMAD overrides | `_bmad/custom/config.toml`, `config.user.toml` |
