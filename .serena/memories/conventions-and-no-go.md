# Conventions and no-go

## Always

- Read top-level `README.md` and `docs/README.md` at session start.
- Run `forge status` to detect Git/BMAD/Serena/MCP context before non-trivial work.
- Use BMAD skills for planning (start with `bmad-help`).
- Put planning artifacts in `_bmad-output/planning-artifacts/<topic>/`.
- Put durable reference in `docs/`.
- Keep `AGENTS.md`, `CLAUDE.md`, `CODEX.md`, `.github/copilot-instructions.md` in sync when conventions change.
- Use **portable mode** (`formatProjectContext(ctx, { portable: true })`) for any artifact written to the repo.
- Run `npm run typecheck && npm run build` in `forge/` before claiming a change works.
- Add a `docs/changelog.md` entry for user-visible Forge changes.

## Never

- Skip BMAD for product or implementation decisions (unless user explicitly asks for `bmad-quick-dev` and the decision is still captured).
- Commit absolute local paths (`/Users/...`, `C:\Users\...`) in artifacts.
- Commit secrets, API keys, or machine-specific config.
- Mix planning artifacts into `docs/` — they belong under `_bmad-output/`.
- Add `ANTHROPIC_API_KEY` requirements to Forge. Auth lives in the local `claude` / `codex` CLIs.
- Re-introduce vendor SDKs (Anthropic SDK was deliberately removed in v0.2).
- Add comments that explain WHAT the code does — only WHY for non-obvious cases.
- Build abstractions for hypothetical futures or add backwards-compat shims for unshipped code.
- Use `git rebase -i`, `git add -i`, or any interactive git command in scripts.

## Quick path vs. full path

- Quick fix / prototype → `bmad-quick-dev`. Still write a one-line decision in the right artifact dir.
- Anything user-visible, architectural, or convention-shifting → full BMAD flow.
