# Routing and Models

How Forge picks which model runs which phase.

## Model registry

Source: [forge/src/models/registry.ts](../../forge/src/models/registry.ts).

| id | cli | flag | strengths | latency | role |
| --- | --- | --- | --- | --- | --- |
| `haiku` | `claude` | `haiku` | classification, coding | fast | Trivial edits, summarization, classification |
| `sonnet` | `claude` | `sonnet` | coding, planning, review | medium | Default coding tier |
| `opus` | `claude` | `opus` | reasoning, planning, coding, long-context | slow | Architecture, ambiguous specs, hard debugging |
| `codex` | `codex` | `gpt-5-codex` | coding | medium | OpenAI Codex CLI for specialist development |

Inspect from the CLI: `forge models`.

## Default routing policy

Source: [forge/src/agents/router.ts](../../forge/src/agents/router.ts).

| Phase | Default | Notes |
| --- | --- | --- |
| `classify` | `haiku` | Always (cheap classification). |
| `ba` | `sonnet` | → `haiku` if complexity = S. → `opus` if ambiguity > 0.7. |
| `tech_arch` | `opus` | Technical system design. |
| `ux_design` | `sonnet` | → `opus` if ambiguity > 0.7. |
| `arch_synthesis` | `opus` | Final TDD and Mermaid diagrams. |
| `stories` | `sonnet` | → `haiku` if complexity = S. |
| `dev` | `codex` when available, otherwise `sonnet` | → `opus` if complexity = XL. Escalates on failure. |
| `qa` | `sonnet` | Test cases plus happy-path and negative-flow tests. |
| `infra` | `sonnet` | → `opus` for L/XL systems. Local Aspire or Docker Compose only. |
| `review` | `sonnet` | — |

## Overrides

### `--model <id>` (global, non-QA)
Applied to every phase **except** `qa`. Lets you pin planning and development while preserving the independent QA pass.

### `--coder <model>` (dev phase only)
Applied only to `dev`. Use this to route development to Codex or Opus while keeping `claude` for planning phases.

### Per-classification adjustments
The router checks `complexity` and `ambiguityScore` from the classifier output and adjusts the default per phase. See the table above.

## Escalation ladder

`haiku → sonnet → opus`. Codex failures fall back to `sonnet`, then continue up the Claude ladder if needed.

When a phase node exits non-zero, the runner retries one rung up the ladder for development, QA, and infra. Planning phases do not escalate automatically to avoid runaway cost on truly-stuck plans.

Rate/session-limit failures use a separate fallback ladder. Claude limits switch to Codex first when the Codex CLI is available, then try the remaining Claude models. Codex limits switch back to Claude. For no-tool phases such as classification or plain chat, Forge can use API-key auth as the final fallback: `OPENAI_API_KEY` for OpenAI Responses API and `ANTHROPIC_API_KEY` for Anthropic Messages API. Tool-enabled phases keep using local CLIs because direct APIs cannot edit files or run tests by themselves.

Codex is a sibling development tier, so Forge does not escalate into Codex on ordinary failures; it only switches into Codex for rate-limit fallback or when explicitly routed there.

## How to add a model

1. Add a `ModelMeta` entry to [`forge/src/models/registry.ts`](../../forge/src/models/registry.ts) with `{id, cli, cliModelFlag, strengths, latencyClass, notes}`.
2. Add or extend a CLI adapter in [`forge/src/cli-adapters/`](../../forge/src/cli-adapters/) if the underlying tool isn't already supported.
3. If the model fits an existing rung, update the ladder in `router.ts`. Otherwise treat it like Codex — a sibling for specific phases.
4. Update this doc, [cli-reference.md](cli-reference.md), and the changelog.

## Cost reporting

`forge cost <run-id>` aggregates per-model `{calls, tokens in, tokens out, cost}` from `audit.jsonl`. Cost is **CLI-reported** — Claude reports it, Codex CLI typically does not (those calls show `$0`).
