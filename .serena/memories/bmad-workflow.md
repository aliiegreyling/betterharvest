# BMAD workflow

BMAD is the workflow spine. Do not bypass it for product planning.

## Installed modules

- BMad Core v6.7.1
- BMad Method (BMM) v6.7.1
- BMad Builder (BMB) v1.8.1

Tool targets: `.agents/skills/` (Codex/Copilot), `.claude/skills/` (Claude Code), `.github/agents/` (Copilot).

## Required sequence

```
bmad-help
  ↓
bmad-brainstorming | bmad-product-brief | bmad-prfaq
  ↓
bmad-prd
  ↓
bmad-create-ux-design        (if UI matters)
  ↓
bmad-create-architecture
  ↓
bmad-create-epics-and-stories
  ↓
bmad-check-implementation-readiness
  ↓
bmad-sprint-planning → bmad-create-story → bmad-dev-story → bmad-code-review
```

For quick fixes: `bmad-quick-dev` — still capture the decision in the correct artifact dir.

## Artifact homes (DO NOT mix)

| Kind | Location |
| --- | --- |
| Planning | `_bmad-output/planning-artifacts/<topic>/` |
| Implementation | `_bmad-output/implementation-artifacts/` |
| Durable reference | `docs/` |
| Per-machine run state | `~/.forge/runs/<id>/` |
| Serena memories | `.serena/memories/` |

## Customization

- Team-level overrides: `_bmad/custom/config.toml`
- Personal overrides (gitignored): `_bmad/custom/config.user.toml`

For building custom agents/workflows/modules: `bmad-agent-builder`, `bmad-workflow-builder`, `bmad-module-builder`.

## When in doubt

Invoke `bmad-help`. It analyzes current state and recommends the next skill.
