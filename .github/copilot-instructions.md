# GitHub Copilot Instructions

Use BMAD Method as the project workflow framework and Serena for semantic code traversal when MCP tools are available.

Before generating product or implementation work, align with the current BMAD phase:

- Analysis: brainstorming, market/domain/technical research, product brief, PRFAQ.
- Planning: PRD and UX design where relevant.
- Solutioning: architecture, epics, stories, implementation readiness.
- Implementation: sprint planning, story creation, development, review, tests, retrospective.

BMAD skills are installed in `.agents/skills/`, and Copilot agent entrypoints are available in `.github/agents/`.

Write durable planning artifacts to `_bmad-output/planning-artifacts/`, implementation artifacts to `_bmad-output/implementation-artifacts/`, and research/project knowledge to `docs/`.

Forge runs as a chat-first CLI harness. Plain text in `forge`/`forge chat` talks to the selected model, while slash commands such as `/request`, `/plan`, `/new`, `/design`, `/work`, `/mcp`, and `/context` drive project workflows.

Forge diagnostics are enabled with `FORGE_DEBUG=1`, `forge --verbose ...`, or `/set debug true`; default errors should include user-friendly next steps.

Chat `/new` is the agentic SDLC team flow: BA requirements, technical architecture, UI/UX design, architecture synthesis, stories, development, QA/testing, local infrastructure, and review. It requires human approval gates after BA, architecture synthesis, QA, and infra unless `--no-approval-gates` is used for local experiments. Step mode still supports phase guidance before long agent phases. Use `forge work` or chat `/work` to iterate on an existing target project, defaulting to `./forge-out`, without recreating it.
