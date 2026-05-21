# Runs and Audit

How Forge persists run state and what each artifact contains.

## Run home

Default: `~/.forge/runs/<run-id>/`.
Override with the `FORGE_HOME` environment variable.

Source: [forge/src/run/state.ts](../../forge/src/run/state.ts).

## Per-run artifacts

```
~/.forge/runs/<run-id>/
├── plan.json              # The full routing plan (classification + nodes)
├── audit.jsonl            # Append-only event log
└── checkpoints/
    └── <phase>.json       # Per-phase result snapshots
```

Optional mirror when `--bmad` is set on `forge new` / `forge plan`:

```
_bmad-output/planning-artifacts/forge-runs/<run-id>/
├── plan.json              # Same plan, BMAD-visible
└── plan.md                # Human-readable rendering
```

Source: [forge/src/bmad/artifacts.ts](../../forge/src/bmad/artifacts.ts).

## audit.jsonl event shape

One JSON object per line. Common fields:

| Field | Meaning |
| --- | --- |
| `ts` | ISO timestamp |
| `kind` | Event type — e.g. `cli_call`, `tool_call`, `phase_start`, `phase_done`, `escalate` |
| `nodeId` | Phase node identifier |
| `modelId` | Model used for this call (when applicable) |
| `durationMs` | Wall-clock duration |
| `tokensIn` / `tokensOut` | CLI-reported usage |
| `costUsd` | CLI-reported cost (Claude only; Codex CLI typically omits) |
| `message` | Free-text status |

## CLI for inspecting runs

### `forge runs`
List the 20 most recent run IDs with prompt snippets.

### `forge log <run-id>`
Print every audit event chronologically. Useful for debugging an escalation chain or a stuck phase.

### `forge cost <run-id>`
Aggregate per-model cost from `audit.jsonl`:

```
sonnet  calls=4  in=12440  out=2310  $0.0612
opus    calls=1  in=  890  out= 145  $0.0245
TOTAL: $0.0857
```

### `forge resume <run-id>`
Re-runs from `plan.json`. Edit the plan first to override routing before resuming.

## Editing a plan before resume

```bash
# 1. Inspect
cat ~/.forge/runs/<id>/plan.json | jq .

# 2. Edit a node's modelId
# (e.g. force impl to opus instead of sonnet)

# 3. Resume
forge resume <id> --target-dir ./forge-out
```

Useful when escalation didn't trigger but you know the phase needs the next rung up.

## Retention

Forge does not auto-delete runs. Clean manually:

```bash
rm -rf ~/.forge/runs/<id>
```

The BMAD-mirrored plan under `_bmad-output/.../forge-runs/<id>/` is repo-tracked — delete via git if no longer relevant.
