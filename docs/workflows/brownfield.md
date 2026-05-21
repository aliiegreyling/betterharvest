# Workflow — Brownfield

Modify this repo or any existing repo with the harness in the loop.

## When to use

You have an existing codebase. You want context-aware changes that respect the current architecture, conventions, and BMAD/Serena state.

## Steps

### 1. Orient

```bash
forge status         # Git, BMAD, Serena, Forge, MCP servers
```

If you're inside a BMAD-aware repo, `status` confirms `BMAD: yes` and shows the planning-artifact root.

### 2. Refresh context

```bash
forge context refresh
```

Writes a portable `project-context.md` artifact under `_bmad-output/planning-artifacts/forge-context/`. Useful as a starting point for the next agent session.

### 3. Inspect the area (Serena-aware once v0.4 lands)

```bash
forge inspect "authentication middleware"
```

Today: surfaces project context and notes Serena availability. v0.4: live semantic lookup.

For now, supplement with BMAD investigation: `bmad-investigate`.

### 4. Plan the change (BMAD)

For a feature: `bmad-prd` (delta) → `bmad-create-architecture` (delta) → `bmad-create-story`.
For a bug: `bmad-investigate` → `bmad-create-story` (or `bmad-quick-dev`).
For a refactor: `bmad-create-architecture` (delta) → `bmad-create-epics-and-stories`.

### 5. Write a Forge work plan artifact

```bash
forge work "Add Serena-backed inspect command"
```

Writes a scaffold under `_bmad-output/planning-artifacts/forge-design/`. This is currently a planning placeholder — execution comes via BMAD story flow.

### 6. Implement via BMAD

```
bmad-create-story → bmad-dev-story
```

For quick changes: `bmad-quick-dev`.

### 7. Review

```
bmad-code-review
```

Or the in-Claude-Code `/review` skill on a PR.

### 8. Document & remember

- Update the relevant page in [`docs/`](../README.md).
- Update or add a Serena memory if the change shifts conventions or introduces a durable decision. See [docs/serena/memories.md](../serena/memories.md).
- Add a [changelog](../changelog.md) entry if it's a Forge-visible change.

## Example: add a CLI command to Forge

1. `forge status` — confirm context.
2. `bmad-investigate` — read [`forge/src/cli.ts`](../../forge/src/cli.ts) and [`forge/src/project/commands.ts`](../../forge/src/project/commands.ts) to learn the pattern.
3. `forge work "Add forge tools list to show MCP-exposed tools"` — write the planning artifact.
4. `bmad-create-story` or `bmad-quick-dev` — implement.
5. Update [docs/forge/cli-reference.md](../forge/cli-reference.md).
6. Add [changelog](../changelog.md) entry.

See the dedicated recipe: [adding-a-forge-command.md](adding-a-forge-command.md).

## Anti-patterns

- Skipping `forge status` — you'll work without context.
- Dumping full files into a prompt instead of using `forge inspect` (post-v0.4) or `bmad-investigate`.
- Committing artifacts with absolute local paths — always portable mode.
- Implementing without a planning artifact for non-trivial changes.
- Forgetting to update agent guidance files (`AGENTS.md`, `CLAUDE.md`, `CODEX.md`, `.github/copilot-instructions.md`) when conventions change.
