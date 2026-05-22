# Roadmap

## Shipped

### Forge v0.1
- TypeScript/Node 20 CLI package.
- Commands: `new`, `plan`, `resume`, `models`, `log`, `cost`, `runs`.
- Anthropic-only model registry (Haiku, Sonnet, Opus) with per-phase routing.
- Fixed six-phase SDLC plan: brief → arch → stories → impl → verify → review.
- Local file/shell sub-agent tools (allowlisted).
- Run state under `~/.forge/runs/<id>/`.

### Forge v0.2 — drop Anthropic SDK, route via CLIs
- Removed `@anthropic-ai/sdk` dependency.
- Shell out to `claude` and `codex` CLIs the user is already authenticated to.

### Forge v0.3 — model-agnostic CLI adapter pattern + Codex routing
- Adapter abstraction (`cli-adapters/`): `claude.ts`, `codex.ts`, `types.ts`, `index.ts`.
- Codex routing for impl phase.

### Context-aware harness slice (post-v0.3, current main)
- Project context detection — Git, branch, BMAD, Serena, Forge, package manager.
- MCP registry with auto-detected Serena stdio config + `forge.mcp.json` / `.forge/mcp.json` / `.mcp.json`.
- Commands: `status`, `context [show|refresh]`, `mcp list`, `mcp health`, `inspect <topic>`, `design <domain> <prompt>`, `work <request>`.
- `--model`, `--context-budget`, `--bmad` flags on `new` and `plan`.
- BMAD-compatible artifact writing under `_bmad-output/planning-artifacts/forge-runs/<id>/`, `forge-context/`, `forge-design/`.
- Portable formatter so artifacts do not leak local paths or secrets.

### Agentic SDLC team slice
- `/new` and `new` now use a traditional SDLC team flow: BA requirements, technical architecture, UI/UX design, architecture synthesis, stories, development, QA/testing, local infrastructure, and review.
- `/work` and `work` run the same gated SDLC team against an existing target project, defaulting to `./forge-out`, and scope agents to the requested change instead of recreating the app.
- Human approval gates after BA, architecture synthesis, QA/testing, and local infrastructure.
- Approval decisions and change requests are recorded in the run audit log; change requests rerun the producing phase with reviewer guidance.
- Architecture output expects Mermaid ERD, flow, and class/component diagrams where relevant.
- Infra remains local-first: Aspire or Docker Compose for local validation, no cloud provisioning.

## Next (v0.4 — context-aware harness, completion)

Goal: turn the placeholder commands into real execution.

- **Live MCP client.** Actually spawn MCP servers and call their tools (not just read config).
- **Serena tool calls.** Wire `find_symbol`, `find_referencing_symbols`, `read_memory`, `write_memory`, diagnostics into the sub-agent tool surface.
- **Context broker.** Token-aware retrieval with rationale ("included file X because of symbol Y").
- **Tool approval / risk policy.** Per-tool risk level, user confirmation gate for high-risk actions. The SDLC role approval gates are in place; live MCP/cloud tool approval still needs policy work.
- **Brownfield execution depth.** `forge work <request>` now executes against an existing target project; live Serena/MCP-backed code inspection still needs the v0.4 context broker.

## Later (v0.5+)

- **Provider-agnostic model clients** beyond Anthropic + Codex CLI (OpenAI direct, local models, others as needed).
- **Local GUI observability surface** (`forge gui`) — watch request understanding, model routing, phase progress, checkpoints, logs, and generated app preview from the same run artifacts the CLI writes.
- **Deployment planning** (`forge deploy plan`) — produce deployment topology and handoff to a deployment MCP.
- **External approval integration** — map SDLC sign-offs to GitHub, Azure DevOps, or another review system.
- **Approval-gated deployment execution.**
- **Full scaffold domains** as first-class subcommands: `forge design data|ux|backend|infra|frontend|deployment` should each produce executable plans, not just placeholder artifacts.
- **Daemon / MCP runtime** — expose Forge itself as an MCP server so other agents can drive it.

## Out of scope (for v1)

- Hosted multi-tenant GUI execution.
- Fully autonomous production deployment without approvals.
- Hard-coded frontend or backend stack assumptions.

## Reference

- Source-of-truth product brief: [_bmad-output/planning-artifacts/agent-cli-harness-brief-2026-05-21/brief.md](../_bmad-output/planning-artifacts/agent-cli-harness-brief-2026-05-21/brief.md)
- v0.2 implementation slice summary: [_bmad-output/planning-artifacts/agent-cli-harness-brief-2026-05-21/addendum.md § v0.2 Implementation Progress](../_bmad-output/planning-artifacts/agent-cli-harness-brief-2026-05-21/addendum.md)
- Original SDLC plan: [_bmad-output/planning-artifacts/agentic-build-system-plan.md](../_bmad-output/planning-artifacts/agentic-build-system-plan.md)
