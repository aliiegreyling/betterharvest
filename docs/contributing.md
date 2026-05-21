# Contributing

How to make changes in this repo without breaking the conventions.

## Golden rules

1. **Planning before code.** Use BMAD skills (`bmad-help` → `bmad-prd` → `bmad-create-architecture` → `bmad-create-epics-and-stories` → `bmad-check-implementation-readiness` → `bmad-dev-story`). For quick fixes, `bmad-quick-dev` is fine but still capture the decision.
2. **Right home for the artifact.**
   - Planning output → `_bmad-output/planning-artifacts/<topic>/`
   - Implementation output → relevant subsystem (e.g. `forge/`) or `_bmad-output/implementation-artifacts/`
   - Durable reference → `docs/`
   - Per-machine run state → `~/.forge/runs/<id>/`
3. **Keep agent files aligned.** Touching workflow conventions? Update all of `AGENTS.md`, `CLAUDE.md`, `CODEX.md`, `.github/copilot-instructions.md` in the same commit.
4. **No secrets, no machine-specific paths in committed artifacts.** Forge has portable formatting modes — use them.

## Adding code to Forge

### Workflow
1. Confirm the change has a planning artifact (PRD section, brief addendum, or story file). If not, write one first.
2. Implement under `forge/src/`. Follow the existing module layout (see [architecture.md](architecture.md)).
3. Update [forge/README.md](../forge/README.md) and the relevant page in [docs/forge/](forge/) if the user-visible surface changed.
4. Run:
   ```bash
   cd forge
   npm run typecheck
   npm run build
   ```
5. Smoke-test the change with `node dist/cli.js <your command>`.
6. If you changed model routing or added a new model, update [docs/forge/routing-and-models.md](forge/routing-and-models.md).
7. Add a changelog entry to [docs/changelog.md](changelog.md).
8. Commit with the existing convention: short imperative summary, optional bullet body.

### Code style
- TypeScript, ES modules, Node 20+ syntax.
- Prefer pure functions where possible. Side-effects (fs, child_process) live in narrow modules (`run/state.ts`, `util/check-cli.ts`, `cli-adapters/`).
- No comments unless WHY is non-obvious. Code should read itself.
- Don't add error handling for impossible cases. Don't add abstractions for hypothetical futures.
- Don't introduce backwards-compatibility shims for code that hasn't shipped yet.

## Adding a new command

See the dedicated recipe: [docs/workflows/adding-a-forge-command.md](workflows/adding-a-forge-command.md).

## Adding documentation

- New page → drop it under the most specific subdirectory of `docs/`.
- Update [docs/README.md](README.md) index.
- Cross-link from at least one neighbor doc so it isn't orphaned.

## Adding a Serena memory

Memories live in `.serena/memories/`. Conventions in [serena/memories.md](serena/memories.md). Briefly:

- One file per memory, kebab-case filename, `.md` extension.
- Lead with a short title; body in 5–30 lines.
- Cover **why** something matters, not just **what** it is. The "what" is in the code.
- Update the memory when the underlying fact changes; remove it when no longer true.

## Adding an MCP server

1. Decide if it's user-config or auto-detect.
2. User-config: add an entry to `forge.mcp.json` (or `.forge/mcp.json` / `.mcp.json`) with `{name, type, command|url, args, enabled, risk}`.
3. Auto-detect: extend `forge/src/mcp/registry.ts` `discoverMcpServers()`.
4. Validate with `forge mcp list` and `forge mcp health`.
5. Document the integration under [docs/forge/context-and-mcp.md](forge/context-and-mcp.md).

## Pull request checklist

- [ ] Planning artifact exists (or is updated) for non-trivial work.
- [ ] `npm run typecheck && npm run build` clean.
- [ ] Smoke test command(s) listed in PR description.
- [ ] Docs updated where user-visible behavior changed.
- [ ] Changelog entry added.
- [ ] No secrets / no absolute local paths in committed files.
- [ ] Agent guidance files still aligned.
