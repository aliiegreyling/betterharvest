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
export ANTHROPIC_API_KEY=sk-ant-...
# Windows PowerShell:
$env:ANTHROPIC_API_KEY = "sk-ant-..."
```

## Usage

```bash
forge new "build a CLI todo app in Python with SQLite" --target-dir ./todo
forge plan "<prompt>"            # print routing plan without executing
forge log <run-id>               # show audit log
forge cost <run-id>              # show cost breakdown
forge models                     # list model registry
forge resume <run-id>            # resume from last checkpoint
```

## How it works

1. **Classifier** (Haiku) tags the prompt — complexity, est. files, stack hint.
2. **Orchestrator** (Sonnet) emits a routing plan: a DAG of SDLC phases (brief → arch → stories → impl → verify → review), each node annotated with `{role, model, budget, tools}`.
3. **Routing policy** picks the cheapest capable model per node; escalates on verification failure.
4. **Sub-agents** execute their nodes with scoped filesystem + shell access.
5. **Verifier** runs lint/typecheck/smoke test; failures trigger re-route.
6. Final project lands in `--target-dir`. Run metadata in `~/.forge/runs/<id>/`.

See [the SDLC plan](../_bmad-output/planning-artifacts/agentic-build-system-plan.md) for the full architecture.
