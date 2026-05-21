# betterharvest

Agentic product-development workspace combining **BMAD Method** (workflow spine), **Serena MCP** (semantic code intelligence), and **Forge** (the in-repo agentic CLI we're building) into a single coherent harness for taking ideas from prompt → planned → scaffolded → maintained software.

This repository is both a working environment and the home of an evolving product: the **Agentic Workflow CLI Harness**, currently implemented as `forge/`.

---

## Table of Contents

- [What's in this repo](#whats-in-this-repo)
- [Quick Start](#quick-start)
- [The Three Layers](#the-three-layers)
- [Repository Layout](#repository-layout)
- [Workflows](#workflows)
- [Documentation Map](#documentation-map)
- [Project Conventions](#project-conventions)

---

## What's in this repo

| Layer | Purpose | Entry Point |
| --- | --- | --- |
| **BMAD Method v6.7.1** | Structured product-development framework (brief → PRD → architecture → stories → delivery) | `_bmad/`, skills like `bmad-help`, `bmad-prd` |
| **Serena MCP** | Semantic code intelligence (symbols, references, memories, diagnostics) | `.serena/project.yml`, `.serena/serena.sh` |
| **Forge CLI** | Headless agentic CLI that shells out to `claude` and `codex` with per-phase model routing | [forge/](forge/README.md) |
| **Agent guidance** | Keeps every agent (Claude Code, Codex, Copilot) aligned on conventions | [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), [CODEX.md](CODEX.md) |
| **Planning artifacts** | All product/architecture/design output from BMAD + Forge | [_bmad-output/planning-artifacts/](_bmad-output/planning-artifacts/) |
| **Durable docs** | Long-lived project knowledge that survives sessions | [docs/](docs/README.md) |

---

## Quick Start

### 1. Orient yourself

Read in this order:

1. This README (high-level)
2. [docs/overview.md](docs/overview.md) — what we're building and why
3. [docs/architecture.md](docs/architecture.md) — how the pieces fit
4. [forge/README.md](forge/README.md) — the working CLI
5. [_bmad-output/planning-artifacts/agent-cli-harness-brief-2026-05-21/brief.md](_bmad-output/planning-artifacts/agent-cli-harness-brief-2026-05-21/brief.md) — the product brief

### 2. Build and try Forge

```bash
cd forge
npm install
npm run build
node dist/cli.js doctor       # verify claude/codex CLIs available
node dist/cli.js status       # detect Git/BMAD/Serena/MCP context
node dist/cli.js models       # list model registry
node dist/cli.js plan "build a CLI todo in Python"
```

Full reference: [docs/forge/cli-reference.md](docs/forge/cli-reference.md).

### 3. Pick a workflow

- Starting a new product idea → [docs/workflows/greenfield.md](docs/workflows/greenfield.md)
- Modifying this repo or another existing one → [docs/workflows/brownfield.md](docs/workflows/brownfield.md)
- Lost? Invoke the `bmad-help` skill from an agent session.

---

## The Three Layers

### BMAD Method — the workflow spine

BMAD gives us a deterministic SDLC sequence: brainstorm → brief/PRFAQ → PRD → UX → architecture → epics & stories → implementation readiness → sprint plan → story delivery → review. Each step has a dedicated skill (e.g. `bmad-prd`, `bmad-create-architecture`). Artifacts land in `_bmad-output/planning-artifacts/`.

See: [docs/bmad/README.md](docs/bmad/README.md)

### Serena MCP — semantic code intelligence

Serena replaces "dump the whole file" with symbol-aware lookup, reference graphs, and durable project memories. Configured in `.serena/project.yml` (TypeScript + C# enabled).

See: [docs/serena/README.md](docs/serena/README.md)

### Forge — the agentic CLI we're building

Forge is the executable harness. v0.3 today; v0.2+ context-awareness slice already merged. It does **not** require an `ANTHROPIC_API_KEY` — it shells out to the `claude` and `codex` CLIs you already authenticated locally and routes per-phase across Haiku / Sonnet / Opus / Codex.

See: [docs/forge/README.md](docs/forge/README.md)

---

## Repository Layout

```
betterharvest/
├── README.md                         # This file
├── AGENTS.md / CLAUDE.md / CODEX.md  # Per-agent guidance (kept aligned)
├── .github/copilot-instructions.md   # Copilot guidance
│
├── _bmad/                            # BMAD framework install (core, bmm, bmb)
│   ├── config.toml                   # Team-level BMAD config
│   ├── custom/                       # Team overrides
│   └── ...
│
├── _bmad-output/
│   └── planning-artifacts/           # All BMAD + Forge planning outputs
│       ├── agentic-build-system-plan.md
│       ├── agent-cli-harness-brief-2026-05-21/
│       ├── forge-context/
│       └── forge-design/
│
├── .serena/
│   ├── project.yml                   # Serena project config
│   ├── serena.sh                     # Repo-local Serena launcher
│   ├── serena-hooks.sh
│   └── memories/                     # Durable project memories
│
├── .agents/skills/                   # Codex + Copilot BMAD skills
├── .claude/skills/                   # Claude Code BMAD skills
│
├── forge/                            # The Forge CLI (our product)
│   ├── README.md
│   ├── package.json
│   └── src/
│       ├── cli.ts                    # Commander entry
│       ├── runner.ts                 # Run orchestration
│       ├── agents/                   # classifier, orchestrator, router, sub-agent, sdlc
│       ├── cli-adapters/             # claude.ts, codex.ts (shells out to CLIs)
│       ├── models/registry.ts        # Model metadata
│       ├── mcp/registry.ts           # MCP server discovery
│       ├── project/                  # context.ts, commands.ts
│       ├── bmad/artifacts.ts         # BMAD-compatible artifact writers
│       ├── run/state.ts              # ~/.forge/runs/<id>/ persistence
│       └── util/
│
└── docs/                             # Durable knowledge base
    ├── README.md                     # Docs index
    ├── overview.md
    ├── architecture.md
    ├── roadmap.md
    ├── changelog.md
    ├── contributing.md
    ├── forge/
    ├── bmad/
    ├── serena/
    └── workflows/
```

---

## Workflows

| Task | Start here |
| --- | --- |
| Plan a new product/feature | `bmad-help` skill, then [docs/workflows/greenfield.md](docs/workflows/greenfield.md) |
| Modify Forge or this repo | [docs/workflows/brownfield.md](docs/workflows/brownfield.md) |
| Add a Forge command | [docs/forge/cli-reference.md](docs/forge/cli-reference.md) + [docs/contributing.md](docs/contributing.md) |
| Wire a new MCP server | [docs/forge/context-and-mcp.md](docs/forge/context-and-mcp.md) |
| Adjust model routing | [docs/forge/routing-and-models.md](docs/forge/routing-and-models.md) |
| Inspect a past Forge run | [docs/forge/runs-and-audit.md](docs/forge/runs-and-audit.md) |

---

## Documentation Map

The full documentation index lives at [docs/README.md](docs/README.md). Every doc page is markdown and lives in this repo — no external wiki.

- **[docs/overview.md](docs/overview.md)** — product vision, problem, solution
- **[docs/architecture.md](docs/architecture.md)** — how BMAD + Serena + Forge fit together
- **[docs/roadmap.md](docs/roadmap.md)** — what's shipped, what's next
- **[docs/changelog.md](docs/changelog.md)** — version-by-version history of Forge
- **[docs/contributing.md](docs/contributing.md)** — conventions for adding code, docs, planning artifacts
- **[docs/forge/](docs/forge/)** — Forge subsystem deep dive
- **[docs/bmad/](docs/bmad/)** — BMAD usage in this repo
- **[docs/serena/](docs/serena/)** — Serena setup and memory conventions
- **[docs/workflows/](docs/workflows/)** — end-to-end recipes

---

## Project Conventions

- **Planning artifacts** go in `_bmad-output/planning-artifacts/` — never inline in `docs/`.
- **Durable knowledge** (architecture, conventions, reference) goes in `docs/`.
- **Implementation artifacts** (generated runnable code) go in `_bmad-output/implementation-artifacts/` or the relevant subsystem (e.g. `forge/`).
- **Agent guidance files** (`AGENTS.md`, `CLAUDE.md`, `CODEX.md`, `.github/copilot-instructions.md`) are kept in sync — change one, change all.
- **No secrets, no machine-specific paths** in committed artifacts. Forge has portable-mode formatters for this.
- **Serena memories** are the long-lived AI memory layer. See [docs/serena/README.md](docs/serena/README.md).

---

Repository: [aliiegreyling/betterharvest](https://github.com/aliiegreyling/betterharvest) · Maintainer: Connor Cress
