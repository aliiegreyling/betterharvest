# Forge subsystem

Forge is a TypeScript/Node 20 CLI under `forge/`. Version `0.3.0` + context-aware harness slice merged.

## Key design decisions

- **No vendor SDKs.** Anthropic SDK was removed in v0.2. Forge shells out to the local `claude` and `codex` CLIs via `child_process`. Result: no API keys in Forge, no SDK lock-in.
- **CLI adapter pattern.** New providers/CLIs are added as adapters under `forge/src/cli-adapters/` implementing `{ name, binName, modelFlag(id), spawn(opts) }`. Today: `claude.ts`, `codex.ts`.
- **Deterministic router.** Model routing is rule-based in `forge/src/agents/router.ts`. Cheaper and predictable than LLM-mediated routing. Override via `--model`/`--coder` flags or by editing `plan.json` before `forge resume`.
- **Phase-scoped tool allowlists.** Every plan node carries its own `allowedTools` and the sub-agent passes them through to the underlying CLI.
- **Run state local, plans repo-tracked.** Per-machine state in `~/.forge/runs/<id>/`. With `--bmad`, the plan also lands in `_bmad-output/planning-artifacts/forge-runs/<id>/`.
- **Portable artifact writing.** Use `formatProjectContext(ctx, { portable: true })` for committed artifacts to avoid leaking absolute paths.

## Module map (forge/src/)

| Module | File | Job |
| --- | --- | --- |
| Entry | `cli.ts` | Commander wiring |
| Runner | `runner.ts` | `runForge()` orchestrates one run |
| Types | `types.ts` | `Plan`, `PlanNode`, `Classification`, `ProjectContext`, `McpServerConfig`, `ModelMeta`, `CliAdapter` |
| Classifier | `agents/classifier.ts` | Haiku-driven prompt tagging |
| Orchestrator | `agents/orchestrator.ts` | Builds the six-phase plan |
| Router | `agents/router.ts` | `pickModel()`, `escalate()`, `annotateRouting()` |
| SDLC | `agents/sdlc.ts` | Phase defs, budgets, allowed tools |
| Sub-agent | `agents/sub-agent.ts` | Executes one node |
| CLI runner | `agents/cli-runner.ts` | Shells the adapter, logs events |
| Adapters | `cli-adapters/{claude,codex}.ts` | Per-CLI spawn semantics |
| Models | `models/registry.ts` | `MODELS[]`, `getModel(id)` |
| MCP | `mcp/registry.ts` | `discoverMcpServers()`, `checkMcpHealth()` |
| Project | `project/context.ts`, `project/commands.ts` | Detection + status/refresh/design/work |
| BMAD | `bmad/artifacts.ts` | `writeBmadPlanArtifact()`, `writeContextArtifact()`, `writeDesignArtifact()` |
| Run state | `run/state.ts` | `readAudit()`, `readPlan()`, `listRuns()`, write helpers |
| Util | `util/check-cli.ts`, `util/resolve-bin.ts` | CLI version probe, PATH resolution |

## Phases (in order)

`classify → brief → arch → stories → impl → verify → review`

## Build / dev

```bash
cd forge
npm install
npm run typecheck
npm run build       # → forge/dist/cli.js
node dist/cli.js doctor
```
