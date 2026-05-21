# Overview

## What we're building

The **Agentic Workflow CLI Harness** — a context-aware command-line system for creating, maintaining, and evolving software projects with AI agents. The harness combines:

- **BMAD Method** as the structured product-development framework (workflow spine).
- **Serena MCP** as the semantic codebase intelligence layer (instead of dumping whole files).
- **Forge** (this repo's `forge/` package) as the actual executable CLI that orchestrates models, tools, and BMAD artifacts.

Working name: `forge`. Product name: Agentic Workflow CLI Harness (TBD).

Source of truth product brief: [_bmad-output/planning-artifacts/agent-cli-harness-brief-2026-05-21/brief.md](../_bmad-output/planning-artifacts/agent-cli-harness-brief-2026-05-21/brief.md).
Source-of-truth SDLC plan: [_bmad-output/planning-artifacts/agentic-build-system-plan.md](../_bmad-output/planning-artifacts/agentic-build-system-plan.md).

## The problem

Generalist coding agents pinned to one model are either expensive (Opus on trivial edits) or under-powered (Haiku on architecture). On top of that, most workflows are prompt-driven and context-fragile: users repeatedly explain the same product intent, reattach the same files, re-discover the same architecture, and manually pick which agent/model/tool should handle each step.

Two failure modes:

- **Greenfield fragmentation.** Frontend, data, infra, deployment get prompted separately. Result lacks a coherent product spine.
- **Brownfield amnesia.** Agents lack durable memory and semantic awareness. They over-read files, miss conventions, duplicate functionality.

## The solution

Build a CLI harness that is the user's agentic control plane:

- Detects the active project or topic (Git, BMAD, Serena, MCP state).
- Routes work through BMAD workflows.
- Uses Serena for semantic code intelligence.
- Selects appropriate models per task — Haiku for classification, Sonnet for default coding, Opus for hard reasoning, Codex for specialist code paths.
- Maintains a tool registry over MCP servers with risk/permission metadata.
- Persists durable decisions as project knowledge and Serena memories.

## Why it's different

- **BMAD as the spine** — explicit planning, PRD, architecture, epics, stories, review, delivery.
- **Serena as the intelligence layer** — symbol lookup, references, memories — not file dumps.
- **MCP-first extensibility** — bring your own tools (GitHub, Azure, Postgres, Slack, …).
- **Per-step model routing** — measurably cheaper than "always Opus" without quality regression.
- **Project/topic awareness** — runs against a repo, a product idea, a feature topic, or a deployment target.
- **End-to-end scaffold path** — product, data, design, frontend, backend, infrastructure, deployment treated as one workflow.

## Who it's for

- **Primary** — builders evolving real software with strong AI assistance but without losing architectural coherence: solo founders, product engineers, technical leads, consultants, small teams.
- **Secondary** — teams standardizing internal AI-assisted delivery: repeatable workflows, agent/tool governance, lower spend, durable cross-session memory.

## Success criteria (v1)

1. From a single prompt, the system produces a runnable project that passes its own generated smoke test, on ≥5 reference prompts of varied complexity.
2. Per-step routing reduces cost per run vs. an "always Opus" baseline by ≥40% with no quality regression.
3. End-to-end medium-prompt run finishes in under 10 minutes wall-clock.
4. Every run produces a structured audit log: agent, model, tool calls, cost.

## Current state (2026-05-21)

- Forge **v0.3** is built and tested. See [changelog.md](changelog.md).
- v0.2 context-aware harness slice merged: project context detection, MCP registry, Serena config awareness, BMAD artifact writing, `status`/`context`/`mcp`/`inspect`/`design`/`work` commands.
- Forge is currently Anthropic-only for execution (via the `claude` and `codex` CLIs). No `ANTHROPIC_API_KEY` is required — auth comes from the CLIs.
- Brownfield-only artifacts so far for non-greenfield flows; full brownfield execution is roadmap.

See [roadmap.md](roadmap.md) for what's next.
