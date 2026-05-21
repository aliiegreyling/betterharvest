# betterharvest

Agentic product-development repository configured with BMAD Method and Serena.

## BMAD Setup

Installed modules:

- BMad Core `v6.7.1`
- BMad Method / BMM `v6.7.1`
- BMad Builder / BMB `v1.8.1`

Configured tool targets:

- Codex: `.agents/skills/`
- Claude Code: `.claude/skills/`
- GitHub Copilot: `.agents/skills/` and `.github/agents/`

## Serena Setup

Serena project configuration lives in `.serena/project.yml`. The repo-local launchers use `uvx` with a repository-local cache:

- `.serena/serena.sh`
- `.serena/serena-hooks.sh`

## Start Planning

Start with `bmad-help` to confirm the next workflow, then use the BMAD planning sequence: brainstorm or product brief / PRFAQ, PRD, UX if needed, architecture, epics and stories, implementation readiness, sprint planning.

Artifacts are written to `_bmad-output/` and project research belongs in `docs/`.
