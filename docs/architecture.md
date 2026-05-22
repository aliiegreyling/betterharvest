# Architecture

How **BMAD**, **Serena**, and **Forge** compose into a single harness.

```
┌──────────────────────────────────────────────────────────────────────┐
│                          User (CLI / agent)                          │
└─────────────────────┬───────────────────────────┬────────────────────┘
                      │                           │
                      │ forge <cmd>               │ /bmad-* skill
                      ▼                           ▼
       ┌──────────────────────────┐   ┌──────────────────────────┐
       │        Forge CLI         │   │       BMAD Method        │
       │  (TypeScript / Node 20)  │   │  (planning skills, agents)│
       │                          │   │                          │
       │  classifier → planner    │   │  brainstorm → brief →    │
       │  → router → sub-agent    │   │  PRD → arch → epics →    │
       │  → cli-adapters          │   │  stories → review        │
       └─────┬─────────────┬──────┘   └─────────────┬────────────┘
             │             │                        │
             │ shells out  │ reads/writes           │ artifacts
             ▼             ▼                        ▼
   ┌──────────────┐ ┌───────────────┐ ┌────────────────────────────┐
   │ claude CLI   │ │ codex CLI     │ │  _bmad-output/planning-    │
   │ (Anthropic)  │ │ (OpenAI)      │ │  artifacts/                │
   └──────────────┘ └───────────────┘ └────────────────────────────┘
             │             │
             │ tool calls  │
             ▼             ▼
       ┌──────────────────────────┐
       │   Serena MCP (stdio)     │  ← .serena/serena.sh
       │  symbols, refs, memories │
       └──────────────────────────┘
```

## Layer responsibilities

### BMAD — workflow & artifacts
- Owns the **process**: brainstorm → brief → PRD → UX → architecture → epics & stories → readiness → sprint → delivery → review.
- Writes structured planning artifacts to `_bmad-output/planning-artifacts/`.
- Surfaced as skills (`bmad-help`, `bmad-prd`, `bmad-create-architecture`, …) invoked from any agent.

### Serena — code intelligence
- Provides **semantic** access to the codebase via MCP: symbol lookup, find references, diagnostics, durable memories.
- Configured in [`.serena/project.yml`](../.serena/project.yml) (TypeScript + C# enabled).
- Launched locally via [`.serena/serena.sh`](../.serena/serena.sh).
- Forge auto-detects Serena and exposes it as an MCP server when present (live tool execution is roadmap).

### Forge — execution & routing
The Forge CLI is the **active component** — the thing that runs.

| Module | File | Responsibility |
| --- | --- | --- |
| Entry | [forge/src/cli.ts](../forge/src/cli.ts) | Commander wiring for every command |
| Runner | [forge/src/runner.ts](../forge/src/runner.ts) | Top-level orchestration of a single run |
| Classifier | [forge/src/agents/classifier.ts](../forge/src/agents/classifier.ts) | Haiku-driven prompt classification |
| Orchestrator | [forge/src/agents/orchestrator.ts](../forge/src/agents/orchestrator.ts) | Builds the phase plan |
| Router | [forge/src/agents/router.ts](../forge/src/agents/router.ts) | Selects model per phase node |
| Sub-agent | [forge/src/agents/sub-agent.ts](../forge/src/agents/sub-agent.ts) | Executes a single phase node |
| SDLC config | [forge/src/agents/sdlc.ts](../forge/src/agents/sdlc.ts) | Phase definitions and budgets |
| CLI runner | [forge/src/agents/cli-runner.ts](../forge/src/agents/cli-runner.ts) | Shells the chosen CLI |
| CLI adapters | [forge/src/cli-adapters/](../forge/src/cli-adapters/) | `claude.ts`, `codex.ts`, `index.ts`, `types.ts` |
| Model registry | [forge/src/models/registry.ts](../forge/src/models/registry.ts) | Haiku / Sonnet / Opus / Codex metadata |
| MCP registry | [forge/src/mcp/registry.ts](../forge/src/mcp/registry.ts) | Discovers configured MCP servers, health |
| Project context | [forge/src/project/context.ts](../forge/src/project/context.ts) | Detects Git, BMAD, Serena, package manager |
| Project commands | [forge/src/project/commands.ts](../forge/src/project/commands.ts) | `status`, `context refresh`, `design`, `work` |
| BMAD artifacts | [forge/src/bmad/artifacts.ts](../forge/src/bmad/artifacts.ts) | Writes plan/context/design files to `_bmad-output/` |
| Run state | [forge/src/run/state.ts](../forge/src/run/state.ts) | Reads/writes `~/.forge/runs/<id>/` |
| Utilities | [forge/src/util/](../forge/src/util/) | `check-cli.ts`, `resolve-bin.ts` |

## Execution flow (a single `forge new` run)

1. **Doctor** — verify `claude` (required) and `codex` (optional) CLIs are present.
2. **Context detect** — Git root, branch, BMAD presence, Serena presence, package manager.
3. **Classify** — Haiku tags the prompt with `{project_type, complexity (S/M/L/XL), est_files, requires_ui, stack_hint, ambiguity_score, summary}`.
4. **Plan** — Orchestrator emits the SDLC team plan: `ba → tech_arch → ux_design → arch_synthesis → stories → dev → qa → infra → review`. Each node has `{role, modelId, goal, inputs, tools}` and some nodes carry approval-gate metadata.
5. **Route** — Router applies deterministic rules with overrides for complexity and ambiguity. See [forge/routing-and-models.md](forge/routing-and-models.md).
6. **Optional `--bmad`** — write the plan as a BMAD-compatible artifact under `_bmad-output/planning-artifacts/forge-runs/<run-id>/`.
7. **Execute** — for each phase node:
   - The sub-agent shells the chosen CLI adapter (`claude` or `codex`) with phase-scoped allowed tools and the target directory as cwd.
   - The native CLI runs its own tool loop, edits files, runs commands.
   - On non-zero exit, the runner escalates one rung up the ladder (haiku → sonnet → opus). Development, QA, and infra have escalation enabled by default.
   - After BA, architecture synthesis, QA, and infra, Forge requests human sign-off. Approvers can approve, request changes, or abort; change requests rerun the producing phase with the reviewer note.
   - Every CLI call writes a JSONL event to `~/.forge/runs/<id>/audit.jsonl`.
8. **Persist** — `plan.json`, `audit.jsonl`, `checkpoints/<phase>.json` under the run directory. Target project lands in `--target-dir`.

## Data flow

```
prompt ──► classifier ──► plan (json) ──► router ──► nodes[]
                              │                          │
                              ▼                          ▼
            _bmad-output/.../forge-runs/<id>/   ~/.forge/runs/<id>/
                  plan.md + plan.json             plan.json
                                                  audit.jsonl
                                                  checkpoints/*.json
                                                                │
                                                                ▼
                                              cli adapter (claude|codex)
                                                                │
                                                                ▼
                                              <target-dir>/  (generated project)
```

## Why this shape

- **Forge is the thinnest possible orchestrator.** The heavy lifting (tool use, file edits, shell commands) happens inside the underlying `claude` / `codex` CLIs that already have battle-tested loops. Forge picks the model and scopes the work; it does not re-implement Claude Code.
- **Auth lives in the CLIs.** No `ANTHROPIC_API_KEY` needed in Forge — users log into `claude` / `codex` once.
- **BMAD artifacts are first-class.** When Forge emits a plan with `--bmad`, it goes to the same `_bmad-output/` tree that BMAD skills write to, so downstream BMAD steps can pick it up.
- **MCP is the extension point.** Tool discovery happens through MCP server config (`forge.mcp.json`, `.forge/mcp.json`, `.mcp.json`, or auto-detected Serena), not hardcoded.

## Open architectural questions

Tracked in the brief and addendum:

- Should Forge stay the product name or become the implementation codename?
- Which model providers after Anthropic?
- Pure CLI vs. daemon/MCP runtime later?
- How should Forge integrate approval gates with GitHub or Azure DevOps later?
- Where does project memory live — repo files, Serena memories, or a Forge-local store?
- How much of BMAD is invoked directly vs. mirrored as Forge-native commands?

See: [_bmad-output/planning-artifacts/agent-cli-harness-brief-2026-05-21/brief.md § Open Questions](../_bmad-output/planning-artifacts/agent-cli-harness-brief-2026-05-21/brief.md).
