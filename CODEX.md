# Codex Instructions

This repository uses BMAD Method as the default agentic framework and Serena for semantic code traversal. Installed Codex skills are in `.agents/skills/`.

Start product-planning turns with `bmad-help` or the appropriate BMAD planning skill. The intended sequence is brainstorm/product brief or PRFAQ, PRD, UX if needed, architecture, epics/stories, implementation readiness, sprint planning, then story execution.

Preserve BMAD output locations:

- Planning artifacts: `_bmad-output/planning-artifacts/`
- Implementation artifacts: `_bmad-output/implementation-artifacts/`
- Project knowledge and research: `docs/`

Use Serena MCP for codebase traversal if the server is exposed. If not, state the limitation and use local search/read tools.

Keep this file, `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` current when the product workflow or agent framework changes.

Forge is chat-first. Running `forge` or `forge chat` opens the harness; plain text chats with the selected model, and slash commands (`/request`, `/plan`, `/new`, `/design`, `/work`, `/mcp`, `/context`) invoke project creation and maintenance journeys.
