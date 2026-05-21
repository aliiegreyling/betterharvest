# Routing and Models

How Forge picks which model runs which phase.

## Model registry

Source: [forge/src/models/registry.ts](../../forge/src/models/registry.ts).

| id | cli | flag | strengths | latency | role |
| --- | --- | --- | --- | --- | --- |
| `haiku` | `claude` | `haiku` | classification, coding | fast | Trivial edits, summarization, classification |
| `sonnet` | `claude` | `sonnet` | coding, planning, review | medium | Default coding tier |
| `opus` | `claude` | `opus` | reasoning, planning, coding, long-context | slow | Architecture, ambiguous specs, hard debugging |
| `codex` | `codex` | `gpt-5-codex` | coding | medium | OpenAI Codex CLI for specialist impl |

Inspect from the CLI: `forge models`.

## Default routing policy

Source: [forge/src/agents/router.ts](../../forge/src/agents/router.ts).

| Phase | Default | Notes |
| --- | --- | --- |
| `classify` | `haiku` | Always (cheap classification). |
| `brief` | `sonnet` | → `haiku` if complexity = S. → `opus` if ambiguity > 0.7. |
| `arch` | `opus` | → `opus` if ambiguity > 0.7 (already default). |
| `stories` | `sonnet` | → `haiku` if complexity = S. |
| `impl` | `sonnet` | → `opus` if complexity = XL. Escalates on failure. |
| `verify` | `sonnet` | — |
| `review` | `sonnet` | — |

## Overrides

### `--model <id>` (global, non-verify)
Applied to every phase **except** `verify`. Lets you pin everything to a specific model without losing the cheap verification step.

### `--coder <model>` (impl phase only)
Applied only to `impl`. Use this to route impl to Codex while keeping `claude` for planning phases.

### Per-classification adjustments
The router checks `complexity` and `ambiguityScore` from the classifier output and adjusts the default per phase. See the table above.

## Escalation ladder

`haiku → sonnet → opus`.

When a phase node exits non-zero, the runner retries one rung up the ladder. Impl has escalation enabled by default; other phases do not escalate to avoid runaway cost on truly-stuck plans.

Codex sits outside the ladder — it's a sibling tier for impl, not an escalation target.

## How to add a model

1. Add a `ModelMeta` entry to [`forge/src/models/registry.ts`](../../forge/src/models/registry.ts) with `{id, cli, cliModelFlag, strengths, latencyClass, notes}`.
2. Add or extend a CLI adapter in [`forge/src/cli-adapters/`](../../forge/src/cli-adapters/) if the underlying tool isn't already supported.
3. If the model fits an existing rung, update the ladder in `router.ts`. Otherwise treat it like Codex — a sibling for specific phases.
4. Update this doc, [cli-reference.md](cli-reference.md), and the changelog.

## Cost reporting

`forge cost <run-id>` aggregates per-model `{calls, tokens in, tokens out, cost}` from `audit.jsonl`. Cost is **CLI-reported** — Claude reports it, Codex CLI typically does not (those calls show `$0`).
