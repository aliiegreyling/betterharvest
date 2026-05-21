# Claude Code Instructions

This repository is configured for BMAD Method and Serena. Use the installed Claude Code skills in `.claude/skills/` and start with `bmad-help` when the next product-planning or implementation step is unclear.

Primary product flow:

1. Brainstorm or product brief / PRFAQ.
2. PRD.
3. UX design when applicable.
4. Architecture.
5. Epics and stories.
6. Implementation readiness.
7. Sprint planning and story delivery.

Do not bypass BMAD artifacts for product planning. Store planning outputs in `_bmad-output/planning-artifacts/`, implementation artifacts in `_bmad-output/implementation-artifacts/`, and durable research in `docs/`.

Use Serena MCP for codebase traversal when available. If it is unavailable, say so and proceed with available tools.

Keep `AGENTS.md`, `CLAUDE.md`, `CODEX.md`, and `.github/copilot-instructions.md` aligned when agentic workflow conventions change.

Forge should be treated as chat-first. `forge` and `forge chat` open the harness; plain text chats with the selected model, while slash commands such as `/request`, `/plan`, `/new`, `/design`, `/work`, `/mcp`, and `/context` start operational BMAD/MCP flows.

Use `FORGE_DEBUG=1`, `forge --verbose ...`, or `/set debug true` when debugging Forge. Keep default errors user-friendly with recovery guidance.
