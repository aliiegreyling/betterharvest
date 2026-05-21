# Agentic Build System — Full SDLC Plan

**Project codename:** `forge` (working name)
**Author:** Connor Cress
**Date:** 2026-05-21
**Status:** Draft v1 — planning artifact

---

## 1. Vision

Build a CLI-first agentic system in the spirit of Replit Agent / Lovable / Bolt, but **headless** (no GUI for v1). A user submits a single natural-language prompt; an **orchestrator** evaluates the prompt's shape, complexity, and intent, then routes the work across a fleet of model-backed agents that collaborate through the full SDLC to produce a working project on disk.

The differentiator is **dynamic, per-step model selection**: the orchestrator (and policy agents) decide *which* model to invoke for *each* sub-task — Haiku for cheap classification and file edits, Sonnet for default coding, Opus for hard reasoning and architecture, Codex/OpenAI models for specialist code paths — instead of pinning the whole run to one model.

### 1.1 Non-goals (v1)
- No GUI, no web app, no live preview pane.
- No multi-tenant hosting. Single-user, local execution.
- No real-time collaborative editing.
- No deployment automation beyond optional `git init` + commit.

### 1.2 Success criteria
1. From a single prompt, the system produces a runnable project (passes its own generated smoke test) for at least 5 reference prompts of varied complexity.
2. The model-routing layer measurably reduces cost per run vs. an "always Opus" baseline by ≥40%, with no quality regression on the reference set.
3. End-to-end run for a "medium" prompt (small CRUD app) completes in under 10 minutes wall-clock.
4. Every run produces a structured audit log: which agent, which model, which tool calls, which cost.

---

## 2. SDLC Approach

We follow the BMAD-aligned flow declared in `CLAUDE.md`:

| Phase | Artifact | Owner | Status |
|---|---|---|---|
| 1. Brainstorm / brief | this document § 3 | PM (Connor) | ✅ in this doc |
| 2. PRD | § 4 | PM | ✅ in this doc |
| 3. UX (CLI/UX) | § 5 | UX | ✅ in this doc |
| 4. Architecture | § 6 | Architect | ✅ in this doc |
| 5. Epics & stories | § 7 | PM + Architect | ✅ in this doc |
| 6. Implementation readiness | § 8 | All | ✅ in this doc |
| 7. Sprint plan & delivery | § 9 | Dev | ✅ in this doc |

Subsequent iterations should shard this document via `bmad-shard-doc` once individual sections grow beyond ~300 lines.

---

## 3. Product Brief

### 3.1 Problem
Generalist coding agents pinned to one model are either expensive (Opus on trivial edits) or under-powered (Haiku on architecture). Users pay the worst-case cost on every token, and quality is bounded by the single chosen model.

### 3.2 Target user
A developer who wants to one-shot a project from a prompt at the terminal, cares about cost transparency, and is comfortable reading a generated repo on disk.

### 3.3 Core idea
An **orchestrator agent** receives the prompt, runs a **classification + planning** pass, and emits a routing plan: a DAG of SDLC steps where each node is annotated with `{agent_role, model, budget, tools}`. Specialist sub-agents execute their nodes. A **policy agent** can re-route mid-run when a step's actual complexity diverges from estimate.

### 3.4 Why now
- The Claude Agent SDK exposes the primitives (sub-agents, tool use, hooks, MCP) needed to compose this without rebuilding the loop.
- Cross-provider routing (Anthropic + OpenAI) is realistic with current SDKs.
- Cost asymmetry between frontier and small models is now ~20×, making routing economically meaningful.

---

## 4. PRD

### 4.1 Functional requirements

**FR-1 — Prompt intake.** CLI accepts a free-text prompt, optional `--budget`, `--target-dir`, `--allowed-models`, `--dry-run`.

**FR-2 — Classification.** A lightweight classifier (Haiku) tags the prompt with: `{project_type, est_complexity ∈ {S,M,L,XL}, est_files, requires_ui, stack_hint, ambiguity_score}`.

**FR-3 — Orchestrator plan.** The orchestrator produces a JSON routing plan covering all SDLC phases (brief → PRD → architecture → stories → implementation → test → review). Each node specifies model, role, expected tool calls, max-token budget, and dependencies.

**FR-4 — Model registry.** Pluggable registry of models with metadata: `{provider, id, context_window, $/Mtok_in, $/Mtok_out, strengths, latency_class}`. Initial set: Opus 4.7, Sonnet 4.6, Haiku 4.5, GPT-Codex (or current OpenAI coding model).

**FR-5 — Routing rules.** Deterministic rules + LLM judgment combined:
- Trivial edits / classification / summarization → Haiku.
- Default coding, refactors, story implementation → Sonnet.
- Architecture, ambiguous specs, multi-file reasoning, debugging hard failures → Opus.
- Specialist code generation when judged superior → Codex.
- Escalation rule: if a Sonnet step fails verification twice, escalate to Opus; if Opus fails, surface to user.

**FR-6 — Sub-agent execution.** Each plan node runs as an isolated sub-agent with scoped tool access (read/write within `target-dir`, shell within allowlist, web fetch optional).

**FR-7 — Verification gates.** Between phases: lint, typecheck, tests (if any), and a "reviewer" agent pass. Failures trigger re-route or human prompt.

**FR-8 — Audit log.** Every run writes `forge-run-<id>/audit.jsonl` with one event per tool call: `{ts, agent, model, tokens_in, tokens_out, cost_usd, tool, ok}`.

**FR-9 — Resume.** A run can be resumed from the last completed phase via `forge resume <run-id>`.

**FR-10 — Project output.** Final artifact is a directory containing: source code, README, generated tests, and `forge-run-<id>/` metadata.

### 4.2 Non-functional requirements

- **NFR-1 Cost cap:** Hard stop when projected cost exceeds `--budget` (default $5). Soft warning at 50%.
- **NFR-2 Determinism of routing:** Same prompt + same model registry + temperature=0 on the planner ⇒ identical plan (modulo provider non-determinism).
- **NFR-3 Observability:** Audit log is sufficient to reconstruct the run end-to-end without re-querying providers.
- **NFR-4 Safety:** Shell commands run through an allowlist; `rm -rf`, network installs, and writes outside `target-dir` are denied by default.
- **NFR-5 Portability:** Runs on Windows (PowerShell), macOS, Linux. Node 20+ or Python 3.11+ runtime (one chosen — see § 6).
- **NFR-6 Latency:** Classification < 5s, plan < 20s, end-to-end medium project < 10 min.

### 4.3 Out of scope (v1)
GUI, hosted execution, multi-user, IDE plugin, vector-store memory, fine-tuned routing model.

### 4.4 Open questions (deferred — do not block v1)
- OQ-1: Do we ship a "judge" model that scores Sonnet vs. Codex outputs head-to-head, or trust the routing heuristic?
- OQ-2: Where does long-term memory live across runs (per-project vs. global)?
- OQ-3: Pricing model if this is ever distributed (BYO-key vs. proxy)?

---

## 5. UX (CLI)

The interface is a single binary `forge` with subcommands.

```
forge new "build a CLI todo app in Python with SQLite" \
  --target-dir ./todo \
  --budget 3.00 \
  --allowed-models opus,sonnet,haiku,codex

forge plan "<prompt>"          # print routing plan, do not execute
forge resume <run-id>          # resume from last checkpoint
forge log <run-id>             # pretty-print audit log
forge cost <run-id>            # cost breakdown by model/agent
forge models                   # list registry
```

### 5.1 Run output (live)
Streaming stdout in three lanes:
1. **Phase banner** — `[2/7] Architecture (model: opus-4.7, budget: $0.80)`
2. **Agent narration** — one-line updates per step (no chain-of-thought spam).
3. **Cost ticker** — running `$0.42 / $3.00`.

### 5.2 Plan file (preview)
`forge plan` writes `plan.json` and a human-readable `plan.md`. The user can edit `plan.json` and pass `--plan plan.json` back to `forge new` to override routing.

### 5.3 Failure UX
On verification failure, the CLI prints:
- The phase that failed.
- The verifier's findings.
- The proposed re-route (model bump / retry / human input request).
- A `[y/N]` confirmation unless `--auto` is set.

---

## 6. Architecture

### 6.1 Stack
- **Language:** TypeScript / Node 20+ (chosen because the Claude Agent SDK is mature in TS and OpenAI SDK ergonomics are equivalent). Python is the alternative; defer to TS for v1.
- **Agent runtime:** Claude Agent SDK for the orchestrator and Claude-backed sub-agents. Direct OpenAI SDK calls for Codex paths, wrapped behind a `ModelClient` interface.
- **Persistence:** Filesystem only in v1. `~/.forge/runs/<id>/` for state, audit log, plan, checkpoints.
- **MCP:** Optional. Use MCP servers for filesystem, shell, and (later) git. Not required for v1 — direct tools are fine.

### 6.2 Components

```
                   ┌──────────────────┐
   prompt  ───▶    │      CLI         │ ──▶ forge-run-<id>/
                   └────────┬─────────┘
                            │
                   ┌────────▼─────────┐
                   │   Classifier     │  (Haiku)
                   │  tag prompt      │
                   └────────┬─────────┘
                            │
                   ┌────────▼─────────┐         ┌──────────────────┐
                   │   Orchestrator   │ ──────▶ │ Model Registry   │
                   │  build plan DAG  │         │ + Routing Policy │
                   └────────┬─────────┘         └──────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ PM agent │  │Arch agent│  │Dev agents│   ... (per plan node)
        │ (sonnet) │  │ (opus)   │  │(sonnet/  │
        │          │  │          │  │ codex)   │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             └─────────────┴─────────────┘
                            │
                   ┌────────▼─────────┐
                   │ Verifier Agent   │  (sonnet)
                   │ lint/test/review │
                   └────────┬─────────┘
                            │
                   ┌────────▼─────────┐
                   │  Policy Agent    │  (haiku/sonnet)
                   │  re-route if fail│
                   └────────┬─────────┘
                            ▼
                       project on disk
```

### 6.3 Key abstractions

```ts
interface ModelClient {
  id: string;                  // "anthropic:claude-opus-4-7"
  call(req: CompletionReq): Promise<CompletionRes>;
  costPer1MIn: number;
  costPer1MOut: number;
  contextWindow: number;
  strengths: Strength[];       // ['planning','coding','classification',...]
}

interface PlanNode {
  id: string;
  phase: 'classify'|'brief'|'prd'|'arch'|'stories'|'impl'|'verify'|'review';
  role: string;
  modelId: string;             // resolved by router
  inputs: string[];            // ids of dependency nodes
  budgetUsd: number;
  tools: ToolName[];
}

interface RoutingPolicy {
  pick(node: PlanNode, ctx: RunContext): ModelClient;
  escalate(node: PlanNode, failure: VerifierResult): ModelClient | null;
}
```

### 6.4 Routing policy (v1 rules)

Implemented as a small rules engine, not an LLM:

| Phase | Default model | Escalation on failure |
|---|---|---|
| classify | Haiku | Sonnet |
| brief/PRD | Sonnet | Opus |
| arch | Opus | — (already top) |
| stories | Sonnet | Opus |
| impl (per-file) | Sonnet | Opus, then Codex |
| verify | Sonnet | Opus |
| review | Sonnet | Opus |

Overrides:
- `complexity == XL` → bump impl default to Opus.
- `requires_ui == true` → keep Sonnet (Opus has no GUI advantage here).
- `ambiguity_score > 0.7` → bump PRD to Opus.

An LLM-judged routing step (Sonnet) reviews and may override the rules, but rule output is the floor.

### 6.5 Tool surface per agent

| Agent | Read | Write | Shell | Web | Notes |
|---|---|---|---|---|---|
| Classifier | — | — | — | — | text-in/JSON-out only |
| Orchestrator | ✓ | plan file | — | — | |
| PM/Arch | ✓ | ./_planning/* | — | optional | docs only |
| Dev | ✓ | ./src/* | allowlist | — | per-file scope |
| Verifier | ✓ | — | allowlist | — | runs tests |
| Policy | audit log | — | — | — | re-route only |

### 6.6 Data flow & state
- All state lives under `~/.forge/runs/<id>/`: `plan.json`, `audit.jsonl`, `checkpoints/`, `output/` (the generated project).
- Checkpoints are emitted after each phase. `forge resume` rehydrates from the last good checkpoint.
- Audit log is append-only; never rewritten.

### 6.7 Security
- Shell allowlist enforced at the runtime layer (`npm`, `pnpm`, `python`, `pip`, `pytest`, `node`, `git`, `ls`, `cat`, `mkdir`, `touch`).
- Network access denied unless the plan node declares `tools: ['web']`.
- Writes constrained to `target-dir` via realpath check on every write.

---

## 7. Epics & Stories

### Epic E1 — CLI skeleton & run lifecycle
- S1.1 Implement `forge new`, `forge plan`, `forge resume`, `forge log`, `forge cost`, `forge models`.
- S1.2 Run directory layout, atomic checkpoint writer, audit log writer.
- S1.3 Config loading (`~/.forge/config.json`, env vars for API keys).

### Epic E2 — Model registry & client abstraction
- S2.1 `ModelClient` interface; implement Anthropic and OpenAI clients.
- S2.2 Registry with cost/context/strength metadata; loaded from `models.json`.
- S2.3 Per-call cost computation and audit emission.

### Epic E3 — Classifier
- S3.1 Prompt template + JSON schema for `{project_type, complexity, files, ui, stack, ambiguity}`.
- S3.2 Haiku-backed classifier with retry on schema fail.
- S3.3 Unit fixtures: 20 labeled prompts.

### Epic E4 — Orchestrator & routing
- S4.1 Plan generator (Sonnet) producing PlanNode DAG.
- S4.2 Routing policy rules engine.
- S4.3 LLM-judged routing override step.
- S4.4 Budget allocation across nodes proportional to phase weight.

### Epic E5 — Sub-agent runtime
- S5.1 Sub-agent dispatcher: spawn agent with role prompt, model, tool set, scoped fs/shell.
- S5.2 Tool implementations: read, write, edit, shell-allowlisted, web-fetch-optional.
- S5.3 Token & cost tracking per agent.

### Epic E6 — SDLC agents
- S6.1 PM agent (brief + PRD generation).
- S6.2 Architect agent (component & data model).
- S6.3 Story-decomposer agent.
- S6.4 Dev agent (per-story implementation loop).
- S6.5 Verifier agent (lint, typecheck, smoke test).
- S6.6 Reviewer agent (final pass + README + run instructions).

### Epic E7 — Policy & re-routing
- S7.1 Verifier failure → policy agent → re-route decision.
- S7.2 Escalation ladder enforcement.
- S7.3 User confirmation flow on hard failure.

### Epic E8 — Observability & DX
- S8.1 Streaming three-lane CLI output.
- S8.2 `forge log` and `forge cost` formatters.
- S8.3 `--dry-run` end-to-end (plan only, no execution).

### Epic E9 — Reference suite & evaluation
- S9.1 5 reference prompts: hello-cli, todo-cli, scraper-script, REST API, static site generator.
- S9.2 Golden expectations (file presence, smoke test exit 0).
- S9.3 Cost/quality benchmark vs. "always Opus" baseline.

---

## 8. Implementation Readiness

| Check | Status | Notes |
|---|---|---|
| Vision & success criteria defined | ✅ | § 1 |
| PRD with FR/NFR | ✅ | § 4 |
| UX/CLI surface defined | ✅ | § 5 |
| Architecture & component map | ✅ | § 6 |
| Epics decomposed | ✅ | § 7 |
| Cost model defined | ✅ | per-model registry + audit |
| Security posture | ✅ | § 6.7 |
| Eval plan | ✅ | E9 |
| Open risks documented | ✅ | § 10 |
| Tech stack picked | ✅ | TS / Node 20 |

**Verdict:** Ready to begin sprint 1.

---

## 9. Sprint Plan

Three two-week sprints to v1.

### Sprint 1 — "Skeleton & one model"
Goal: `forge new "<prompt>"` runs end-to-end on a fixed plan, single model (Sonnet), produces a hello-world project.
- E1 (all), E2 S2.1–S2.3 (Anthropic only), E5 S5.1–S5.2, E6 S6.1 + S6.4 minimal, E8 S8.1.
- Exit: hello-cli reference prompt produces a runnable project.

### Sprint 2 — "Routing & SDLC depth"
Goal: real multi-phase SDLC with dynamic routing across Haiku/Sonnet/Opus.
- E3 (all), E4 (all), E6 S6.2–S6.3 + S6.5–S6.6, E7 S7.1–S7.2, E8 S8.2–S8.3.
- Exit: todo-cli and scraper-script reference prompts pass; routing measurably cheaper than Sprint-1 baseline.

### Sprint 3 — "Codex, resume, polish"
Goal: cross-provider routing, resume, full eval suite, audit completeness.
- E2 OpenAI client, E7 S7.3, E9 (all), hardening.
- Exit: all 5 reference prompts pass, ≥40% cost reduction vs. "always Opus" baseline, resume works.

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Routing heuristic picks wrong model often enough to hurt quality | M | H | Sprint-2 LLM-judged override + escalation ladder; eval suite catches regressions |
| Cross-provider parity (Codex vs. Claude) harder than expected | M | M | Behind an interface; can ship v1 Claude-only if Codex blocks |
| Sub-agent token cost explodes on large repos | M | H | Hard per-node budget; verifier short-circuits on early failure |
| Verifier passes broken code (false negative) | M | H | Require generated smoke test + actual execution, not just typecheck |
| Plan DAG becomes unmanageably wide on XL prompts | L | M | Hard cap on parallel impl nodes; serialize beyond cap |
| Windows shell quoting bugs (project is on Windows) | M | M | Use cross-platform shell adapter; CI on win + linux |
| Prompt-injection in user prompt steers agents | L | M | System prompts isolate user content; tool allowlists are the real guardrail |

---

## 11. Decisions Log

| # | Decision | Rationale |
|---|---|---|
| D1 | TypeScript over Python | Agent SDK maturity, single-binary distribution via `pkg`/`bun` |
| D2 | Rules engine + LLM override (not pure-LLM routing) | Determinism floor; cheaper; debuggable |
| D3 | Filesystem state, no DB | Single-user v1; resume is just file replay |
| D4 | No GUI in v1 | Scope; explicit non-goal |
| D5 | Claude Agent SDK as runtime | Sub-agents, hooks, MCP all native |
| D6 | Per-node budget enforced, not per-run only | Prevents one runaway agent from burning the run |

---

## 12. Next Actions

1. Create repo scaffold under `forge/` (separate from `betterharvest`, or as a subdirectory — TBD).
2. Land Epic E1 + E2 in Sprint 1, week 1.
3. Wire reference prompt #1 (hello-cli) to validate the skeleton end-to-end.
4. Shard this document via `bmad-shard-doc` once any section exceeds ~300 lines.
5. Open a follow-up artifact `_bmad-output/planning-artifacts/forge-architecture.md` if § 6 needs to grow beyond what fits here.

---

*End of plan.*
