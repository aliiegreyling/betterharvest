# Serena Memories

How we use Serena's durable memory layer.

## What memories are for

Memories persist across sessions. They give every future AI session enough context to act without re-explaining the project. Think of `docs/` as **human reference** and Serena memories as **AI working knowledge**.

Memories should answer questions like:

- What is this project, at a high level?
- What conventions must I follow?
- Where do specific kinds of artifacts live?
- What is the active sub-system I'm working in?
- What decisions have already been made (and why)?

## What NOT to save

- Things obviously derivable from the code (use `find_symbol`).
- Ephemeral task context (use the conversation).
- Secrets or machine-specific paths.
- Stale snapshots that will lie when the code changes.

## Conventions in this repo

- **Location:** `.serena/memories/`
- **One file per memory**, kebab-case, `.md` extension.
- **Lead with the title as `# H1`**, then a 1–2 sentence summary, then detail.
- **Cross-link** to repo files using project-relative paths (`forge/src/cli.ts`, not absolute).
- **Cover the why**, not just the what. The "what" lives in code or `docs/`.
- **Update when reality changes**; delete when no longer true.

## Current memories

Catalog of memories saved by the documentation pass (2026-05-21):

| File | Covers |
| --- | --- |
| `project-orientation.md` | What betterharvest is, the three layers, where to start |
| `repository-layout.md` | Directory map and what each top-level thing is for |
| `forge-subsystem.md` | Forge architecture, modules, execution flow |
| `forge-cli-commands.md` | Every CLI command and key flags |
| `forge-routing-policy.md` | Model registry, per-phase defaults, escalation ladder |
| `bmad-workflow.md` | BMAD planning sequence and artifact homes |
| `serena-setup.md` | Serena config, launchers, language coverage |
| `mcp-and-context-model.md` | Project context detection and MCP server registry |
| `conventions-and-no-go.md` | Repo conventions and things to never do |
| `roadmap-and-current-state.md` | Shipped vs. next; v0.4 priorities |
| `planning-artifacts-catalog.md` | Map of all BMAD planning artifacts and what's in each |

## How to add or update a memory

When working as an AI agent with Serena MCP available:

```
write_memory("memory-name", "<full markdown content>")
```

When working offline (this pass), write directly to `.serena/memories/<name>.md`. Then update [docs/serena/memories.md](memories.md) (this file) to list it.

## When to write a memory vs. a doc

| Trigger | Memory | Doc |
| --- | --- | --- |
| Future AI sessions need to know this to do good work | ✅ | maybe |
| Humans need to read this | maybe | ✅ |
| It's a decision with a *why* | ✅ | ✅ if the why matters to humans |
| It's a snapshot of state that will rot | ❌ | ❌ (use `git log`) |
| It's a planning artifact | ❌ | ❌ (use `_bmad-output/`) |
