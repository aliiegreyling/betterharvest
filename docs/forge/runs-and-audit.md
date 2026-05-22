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
| `kind` | Event type — e.g. `cli_call`, `phase_start`, `phase_end`, `approval_requested`, `approval_granted`, `changes_requested`, `approval_aborted` |
| `nodeId` | Phase node identifier |
| `modelId` | Model used for this call (when applicable) |
| `durationMs` | Wall-clock duration |
| `tokensIn` / `tokensOut` | CLI-reported usage |
| `costUsd` | CLI-reported cost (Claude only; Codex CLI typically omits) |
| `message` | Free-text status |
| `approvalGateId` | Sign-off gate identifier when the event records a human approval step |
| `approverRole` | Expected human role for the approval gate |
| `revision` | Revision cycle number for phase reruns after requested changes |

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
Continues from the first phase whose checkpoint is missing or failed. Completed phases are skipped, so a run that fails in development resumes from development rather than re-running BA, architecture, and stories.

```bash
forge resume <run-id> --target-dir ./forge-out
```

The resumed run uses the existing `plan.json`. Edit the plan first if you want to override routing before resuming.

## Editing a plan before resume

```bash
# 1. Inspect
cat ~/.forge/runs/<id>/plan.json | jq .

# 2. Edit a node's modelId
# (e.g. force dev to opus instead of codex)

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
