# Repository layout

```
betterharvest/
├── README.md                  # Top-level overview, conventions
├── AGENTS.md, CLAUDE.md, CODEX.md, .github/copilot-instructions.md
│                              # Per-agent guidance, kept in sync
│
├── _bmad/                     # BMAD framework install
│   ├── config.toml            # Team config
│   ├── custom/                # Team + user overrides
│   ├── core/, bmm/, bmb/      # Modules
│   └── scripts/
│
├── _bmad-output/
│   └── planning-artifacts/    # ALL planning output goes here
│       ├── agentic-build-system-plan.md
│       ├── agent-cli-harness-brief-2026-05-21/
│       ├── forge-context/     # forge context refresh output
│       ├── forge-design/      # forge design / work output
│       └── forge-runs/<id>/   # forge new --bmad mirrored plans
│
├── .serena/
│   ├── project.yml            # TypeScript + C# language servers
│   ├── serena.sh, serena-hooks.sh
│   └── memories/              # Durable AI memories (this dir)
│
├── .agents/skills/            # Codex + Copilot BMAD skills
├── .claude/skills/            # Claude Code BMAD skills
│
├── forge/                     # The Forge CLI (product)
│   ├── README.md, package.json
│   └── src/
│       ├── cli.ts             # Commander entry
│       ├── runner.ts          # Single-run orchestration
│       ├── types.ts           # Shared types
│       ├── agents/            # classifier, orchestrator, router, sub-agent, cli-runner, sdlc
│       ├── cli-adapters/      # claude.ts, codex.ts, types.ts, index.ts
│       ├── models/registry.ts # Model metadata
│       ├── mcp/registry.ts    # MCP server discovery
│       ├── project/           # context.ts, commands.ts
│       ├── bmad/artifacts.ts  # BMAD-compatible writers
│       ├── run/state.ts       # ~/.forge/runs/<id>/ persistence
│       └── util/              # check-cli.ts, resolve-bin.ts
│
└── docs/                      # Durable human-facing reference
    ├── README.md              # Docs index
    ├── overview.md, architecture.md, roadmap.md, changelog.md, contributing.md
    ├── forge/                 # Forge subsystem deep dive
    ├── bmad/                  # BMAD usage
    ├── serena/                # Serena setup, memory conventions
    └── workflows/             # Greenfield, brownfield, adding-a-forge-command
```

## Per-machine state (not in repo)

- `~/.forge/runs/<run-id>/plan.json` + `audit.jsonl` + `checkpoints/`
- Override with `FORGE_HOME` env var.
