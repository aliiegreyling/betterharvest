# GitHub Copilot Instructions

Use BMAD Method as the project workflow framework and Serena for semantic code traversal when MCP tools are available.

Before generating product or implementation work, align with the current BMAD phase:

- Analysis: brainstorming, market/domain/technical research, product brief, PRFAQ.
- Planning: PRD and UX design where relevant.
- Solutioning: architecture, epics, stories, implementation readiness.
- Implementation: sprint planning, story creation, development, review, tests, retrospective.

BMAD skills are installed in `.agents/skills/`, and Copilot agent entrypoints are available in `.github/agents/`.

Write durable planning artifacts to `_bmad-output/planning-artifacts/`, implementation artifacts to `_bmad-output/implementation-artifacts/`, and research/project knowledge to `docs/`.

