# Roadmap and current state

As of 2026-05-21.

## Shipped

- **Forge v0.1** — agentic CLI, six-phase plan, Anthropic-only routing, local tools, run state.
- **Forge v0.2** — dropped Anthropic SDK, route via `claude` and `codex` CLIs.
- **Forge v0.3** — CLI adapter pattern, Codex routing for impl phase.
- **Context-aware harness slice** (post-v0.3) — project context detection, MCP registry, Serena config awareness, BMAD artifact writing, `status`/`context`/`mcp`/`inspect`/`design`/`work` commands, `--model`/`--context-budget`/`--bmad` flags.

## v0.4 priorities (next)

1. **Live MCP client** — actually spawn servers and call tools (not just read config).
2. **Serena tool calls** — `find_symbol`, `find_referencing_symbols`, `read_memory`, `write_memory`, diagnostics wired into sub-agent tool surface.
3. **Context broker** — token-aware retrieval with rationale.
4. **Tool approval / risk policy** — user confirmation gate for `high`-risk calls.
5. **Brownfield execution** — `forge work <request>` should plan + inspect + implement + verify + review on the active repo, not just write an artifact.

## Later (v0.5+)

- Provider-agnostic model clients beyond Anthropic + Codex CLI.
- Deployment planning (`forge deploy plan`) and approval-gated deployment execution.
- First-class scaffold-domain subcommands: `design data|ux|backend|infra|frontend|deployment` producing executable plans.
- Daemon / MCP runtime — expose Forge itself as an MCP server.

## Out of scope (v1)

- GUI / browser canvas / live preview.
- Fully autonomous production deployment.
- Multi-tenant hosted execution.
- Hard-coded frontend/backend stack assumptions.

## Open architectural questions (tracked in brief)

- Forge as product name vs. implementation codename under a broader harness name?
- Which model providers after Anthropic?
- Pure CLI vs. daemon/MCP runtime?
- User approval representation for risky calls?
- Project memory: repo files vs. Serena memories vs. Forge-local store?
- How much BMAD invoked directly vs. mirrored as Forge-native commands?
- First target deployment platform?

See `_bmad-output/planning-artifacts/agent-cli-harness-brief-2026-05-21/brief.md § Open Questions`.
