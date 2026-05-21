# Forge model routing

Source: `forge/src/agents/router.ts`, `forge/src/models/registry.ts`.

## Models

| id | cli | flag | role |
| --- | --- | --- | --- |
| `haiku` | `claude` | `haiku` | classify, trivial edits |
| `sonnet` | `claude` | `sonnet` | default coding |
| `opus` | `claude` | `opus` | architecture, ambiguous specs, hard reasoning |
| `codex` | `codex` | `gpt-5-codex` | specialist coding (impl phase) |

## Default per-phase

| Phase | Default | Adjustments |
| --- | --- | --- |
| `classify` | `haiku` | always |
| `brief` | `sonnet` | `haiku` if complexity=S; `opus` if ambiguity>0.7 |
| `arch` | `opus` | (already top) |
| `stories` | `sonnet` | `haiku` if complexity=S |
| `impl` | `sonnet` | `opus` if complexity=XL; **escalates on failure** |
| `verify` | `sonnet` | — |
| `review` | `sonnet` | — |

## Escalation ladder

`haiku → sonnet → opus`. Codex sits outside as a sibling for impl, not an escalation target.

Only `impl` escalates by default. This avoids runaway cost on stuck plans elsewhere.

## Overrides

- `--model <id>` — applies to every phase except `verify` (keeps the cheap quality gate).
- `--coder <model>` — applies only to `impl`.
- Edit `~/.forge/runs/<id>/plan.json` and `forge resume <id>` to surgically override per node.

## Why deterministic

- Cheaper than an LLM router.
- Predictable cost envelope.
- Easy to override by editing one file.
- Cost-reduction goal (vs. always-Opus) is ≥40% with no quality regression. See `_bmad-output/planning-artifacts/agentic-build-system-plan.md`.

## Cost reporting caveat

Claude reports tokens + USD per call. Codex CLI typically does NOT report cost — those calls show `$0` in `forge cost <run-id>`.
