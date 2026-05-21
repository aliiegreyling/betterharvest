# Agent Instructions

## Repository Context

This repository uses BMAD Method as the primary agentic product-development framework. BMAD is installed in this repo with:

- BMad Core `v6.7.1`
- BMad Method / BMM `v6.7.1`
- BMad Builder / BMB `v1.8.1`
- Tool targets: Codex, Claude Code, GitHub Copilot

Generated BMAD framework files live under `_bmad/`. Planning outputs live under `_bmad-output/planning-artifacts/`, implementation outputs under `_bmad-output/implementation-artifacts/`, and durable project knowledge under `docs/`.

Serena is configured for this repository in `.serena/project.yml` with TypeScript and C# enabled.

## Required Workflow

Use BMAD before product or implementation decisions. Default sequence for a new product is:

1. `bmad-help` to confirm current state and next action.
2. `bmad-brainstorming`, `bmad-product-brief`, or `bmad-prfaq` to shape the concept.
3. `bmad-prd` to create and validate the PRD.
4. `bmad-create-ux-design` when UI/UX is material.
5. `bmad-create-architecture` for technical decisions.
6. `bmad-create-epics-and-stories` for backlog breakdown.
7. `bmad-check-implementation-readiness` before coding.
8. `bmad-sprint-planning`, then `bmad-create-story`, `bmad-dev-story`, and `bmad-code-review` for delivery.

Do not jump straight to implementation unless the user explicitly asks for a quick path. For quick fixes or prototypes, use `bmad-quick-dev` and still capture decisions in the correct BMAD artifact directory.

## Tooling Expectations

Serena MCP should be used when available for codebase traversal and memory-aware development. If Serena is not exposed in the active session, state that limitation and use available filesystem, GitHub, and CLI tooling.

GitHub and Azure DevOps may be in play. Use MCP connectors and CLI tools where appropriate, preferring structured MCP data for repository, PR, issue, and workflow context when available.

Keep agent guidance current as the system evolves. Update `AGENTS.md`, `CLAUDE.md`, `CODEX.md`, and `.github/copilot-instructions.md` when framework decisions, architecture standards, or product workflow conventions change.

Forge is now a chat-first harness. Running `forge` or `forge chat` opens an interactive session where plain text chats with the selected model and slash commands invoke operations. Use `/request` to capture a project idea without spending model tokens, then `/plan`, `/new`, `/design`, `/work`, `/mcp`, or `/context` to drive the relevant BMAD/MCP workflow.

## Engineering Standards

Treat this as a .NET and TypeScript product workspace unless future planning chooses otherwise. Favor clean, scalable development and pragmatic platform choices across Azure, Resend, Descope, Neon, and related integration services.

When designing features, consider MCP communication points for relevant platforms and document those decisions in BMAD architecture or research artifacts.

## BMAD Customization

Team-level BMAD overrides belong in `_bmad/custom/config.toml`. Personal overrides belong in `_bmad/custom/config.user.toml` and should not be committed.

Use BMad Builder when we need custom agents, workflows, or modules:

- `bmad-agent-builder` for custom persona agents.
- `bmad-workflow-builder` for repeatable workflows.
- `bmad-module-builder` for packaging a reusable module.
