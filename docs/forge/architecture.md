# Forge — Internal Architecture

A closer look at how the pieces inside `forge/src/` work together.

For the high-level "BMAD + Serena + Forge" picture, see [../architecture.md](../architecture.md).

## Module map

```
forge/src/
├── cli.ts                  # Commander wiring — the user-visible surface
├── runner.ts               # runForge() — orchestrates a single run
├── types.ts                # Shared types: Plan, PlanNode, ProjectContext, McpServerConfig, etc.
├── agents/
│   ├── classifier.ts       # Haiku-driven prompt classification
│   ├── orchestrator.ts     # Builds the SDLC team plan
│   ├── router.ts           # pickModel(), escalate(), annotateRouting()
│   ├── sdlc.ts             # Phase definitions, default budgets, allowed tools
│   ├── sub-agent.ts        # Executes one phase node
│   └── cli-runner.ts       # Shells the chosen adapter, logs events
├── cli-adapters/
│   ├── index.ts            # listAdapters()
│   ├── types.ts            # CliAdapter interface
│   ├── claude.ts           # Claude Code CLI adapter
│   └── codex.ts            # OpenAI Codex CLI adapter
├── models/
│   └── registry.ts         # ModelMeta[] + getModel(id)
├── mcp/
│   └── registry.ts         # discoverMcpServers(), checkMcpHealth()
├── project/
│   ├── context.ts          # detectProjectContext(), formatProjectContext()
│   └── commands.ts         # buildStatusText(), refreshContext(),
│                           # createDesignArtifact(), createBrownfieldWorkPlan()
├── bmad/
│   └── artifacts.ts        # writeBmadPlanArtifact(), writeContextArtifact(), writeDesignArtifact()
├── run/
│   └── state.ts            # readAudit(), readPlan(), listRuns(), writePlan(), appendAudit()
└── util/
    ├── check-cli.ts        # checkCli(name) — version probe
    └── resolve-bin.ts      # Find a binary on PATH
```

## Sequence — `forge new <prompt>`

```
cli.ts (new action)
  └─► doctor()                                   # check-cli on every adapter
  └─► runForge({ prompt, targetDir, ... })       # runner.ts
       │
       ├─► detectProjectContext()                # project/context.ts
       ├─► classify(prompt)                      # agents/classifier.ts
       │     └─► claude-adapter, model=haiku
       │
       ├─► buildPlan(classification, opts)       # agents/orchestrator.ts
       │     └─► annotateRouting(nodes, c, opts.modelOverride)   # agents/router.ts
       │
       ├─► writePlan(runId, plan)                # run/state.ts → ~/.forge/runs/<id>/plan.json
       ├─► if opts.bmadOutput:
       │     writeBmadPlanArtifact(ctx, plan)    # bmad/artifacts.ts
       │
       ├─► for node of plan.nodes:               # excluding 'classify'
       │     ├─► subAgent.run(node, plan)        # agents/sub-agent.ts
       │     │     └─► cliRunner.invoke(adapter, modelFlag, prompt, allowedTools, cwd)
       │     │           └─► adapter.spawn(...)        # cli-adapters/<x>.ts
       │     │                 └─► child_process → claude/codex
       │     │
       │     ├─► appendAudit({ kind: "cli_call", ... })
       │     ├─► if exit != 0 and node.escalate:
       │     │     model = escalate(model); retry
       │     ├─► writeCheckpoint(node)
       │     ├─► if node has approvalGate:
       │     │     request approve / changes / abort
       │     ├─► if changes requested:
       │     │     rerun node with reviewer note, up to 3 cycles
       │
       └─► done
```

## Sequence — `forge status`

```
cli.ts (status action)
  └─► buildStatusText()                          # project/commands.ts
       ├─► detectProjectContext()
       ├─► discoverMcpServers(ctx)               # mcp/registry.ts
       └─► for each: checkMcpHealth(ctx, server)
```

## Key types (forge/src/types.ts)

- `Phase = "classify" | "ba" | "tech_arch" | "ux_design" | "arch_synthesis" | "stories" | "dev" | "qa" | "infra" | "review"`
- `Classification = { projectType, complexity ("S"|"M"|"L"|"XL"), estFiles, requiresUi, stackHint, ambiguityScore, summary }`
- `PlanNode = { id, phase, role, modelId, goal, inputs, allowedTools, approvalGate?, expectedArtifacts? }`
- `Plan = { runId, prompt, classification, nodes[], contextBudget, modelOverride? }`
- `ProjectContext = { cwd, projectRoot, gitRoot?, branch?, hasBmad, hasSerena, hasForge, bmadPlanningDir?, serenaProjectFile?, packageManager }`
- `McpServerConfig = { name, type ("stdio"|"http"), command?, args?, url?, enabled, source, risk ("low"|"medium"|"high") }`
- `McpHealth = { name, ok, source, message }`
- `ModelMeta = { id, cli, cliModelFlag, strengths[], latencyClass, notes }`
- `CliAdapter = { name, binName, modelFlag(id), spawn(opts) }`

## Design choices worth knowing

- **No vendor SDKs.** The Anthropic SDK was removed in v0.2; everything goes through the locally installed `claude` / `codex` CLIs. Result: no API keys, no SDK lock-in, but Forge can't observe streaming token-by-token — only final usage from the CLI.
- **Adapter pattern.** New models that come with their own CLI (e.g. Codex) are added as adapters, not as Anthropic-style integrations. Adapters expose `{ name, binName, modelFlag(id), spawn(opts) }`.
- **Phase-scoped tool allowlists.** Every plan node carries its own `allowedTools`. The sub-agent passes these through to the underlying CLI so planning phases can stay document-only while development, QA, and infra can run local commands.
- **Human approval gates.** BA, architecture synthesis, QA, and infra nodes carry approval metadata. Forge pauses after those phases for approve/request-changes/abort and records the decision in the audit log.
- **Deterministic router with overrides.** Routing is rule-based, not LLM-mediated. Cheaper, predictable, and easy to override via `--model` / `--coder` or by editing the plan before `resume`.
- **Run state is local; planning artifacts are repo-tracked.** Per-machine ephemerality goes under `~/.forge/`; anything the team should see lives under `_bmad-output/`.
- **Portable artifact writing.** All artifacts that touch the repo use project-relative paths so they survive shipping across machines.
