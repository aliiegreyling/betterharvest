# forge

Headless agentic CLI that builds projects from a single prompt with **dynamic per-step model routing** across Haiku / Sonnet / Opus.

## Install

```bash
cd forge
npm install
npm run build
npm link    # exposes `forge` globally (optional)
```

Set your API key:

```bash
export ANTHROPIC_API_KEY="<your-anthropic-api-key>"
# Windows PowerShell:
$env:ANTHROPIC_API_KEY = "<your-anthropic-api-key>"
```

## Usage

```bash
forge new "build a CLI todo app in Python with SQLite" --target-dir ./todo
forge plan "<prompt>"            # print routing plan without executing
forge log <run-id>               # show audit log
forge cost <run-id>              # show cost breakdown
forge models                     # list model registry
forge resume <run-id>            # resume from last checkpoint
forge status                     # show Git/BMAD/Serena/MCP project context
forge context refresh            # write BMAD project context artifact
forge mcp list                   # list discovered MCP servers
forge mcp health                 # validate MCP server config
forge inspect "auth flow"        # inspect a topic with current project context
forge design data "domain model" # write a BMAD design artifact
forge work "add feature X"       # write a brownfield work-plan artifact
```

Useful routing flags:

```bash
forge plan "build a CLI todo app" --model sonnet --context-budget low --bmad
forge new "build a CLI todo app" --budget 5 --context-budget deep --bmad
```

## How it works

1. **Classifier** (Haiku) tags the prompt — complexity, est. files, stack hint.
2. **Orchestrator** (Sonnet) emits a routing plan: a DAG of SDLC phases (brief → arch → stories → impl → verify → review), each node annotated with `{role, model, budget, tools}`.
3. **Routing policy** picks the cheapest capable model per node; escalates on verification failure.
4. **Sub-agents** execute their nodes with scoped filesystem + shell access.
5. **Verifier** runs lint/typecheck/smoke test; failures trigger re-route.
6. Final project lands in `--target-dir`. Run metadata in `~/.forge/runs/<id>/`.

## v0.2 foundations

Forge now detects repository context and can surface BMAD, Serena, and MCP readiness without loading large project context into the model. BMAD-compatible planning artifacts can be emitted under `_bmad-output/planning-artifacts/`, while run internals remain local under `~/.forge` or `FORGE_HOME`.

Current MCP support is registry/health oriented. Serena is auto-detected from `.serena/project.yml` and `.serena/serena.sh`; live MCP tool execution is the next integration step.

See [the SDLC plan](../_bmad-output/planning-artifacts/agentic-build-system-plan.md) for the full architecture.
