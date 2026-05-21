# Addendum: Agentic Workflow CLI Harness Brief

## Source Input

The initial brief is based on the user request to plan an Agentic Workflow driven CLI Harness that:

- Uses Serena MCP and the BMAD Agent Framework.
- Is context-aware for whatever topic or project the user is working on.
- Can switch models.
- Understands available tools.
- Saves token usage.
- Creates new projects and maintains/modifies existing projects.
- Scaffolds new projects end-to-end across data-structure design, design systems, frontend UI/UX, backend design, infrastructure, and deployment coverage.
- Supports MCP connections selected by the user.

## Notes for PRD

The PRD should turn the brief into concrete requirements for:

- CLI commands and interaction model.
- Model routing policy.
- MCP registry and permissions model.
- Context-broker behavior.
- BMAD workflow integration.
- Serena MCP integration.
- New-project scaffold lifecycle.
- Existing-project maintenance lifecycle.
- Deployment planning and execution guardrails.

## Forge v0.1 Baseline Analysis

Current implementation inspected under `forge/`.

### What Exists

- TypeScript/Node 20 CLI package named `forge`.
- CLI commands: `new`, `plan`, `resume`, `models`, `log`, `cost`, and `runs`.
- Anthropic model registry with Haiku, Sonnet, and Opus metadata.
- Prompt classifier using Haiku.
- Fixed SDLC plan builder with phases: brief, architecture, stories, implementation, verify, review.
- Routing policy that selects models by phase, complexity, and ambiguity.
- Escalation ladder from Haiku to Sonnet to Opus.
- Sub-agent runner with a max-step loop, model-call audit events, tool-call audit events, and budget checks.
- Local tool surface for scoped file read/write/edit/list and allowlisted shell commands.
- Run persistence under `FORGE_HOME` or `~/.forge/runs/<id>/`.
- Generated target project output via `--target-dir`.

### Gap Analysis Against Brief

- MCP registry is missing. Forge has direct local tools, not MCP-discovered tools.
- Serena integration is missing. No semantic symbol lookup, memories, diagnostics, project onboarding, or context-aware code traversal exists yet.
- BMAD integration is partial conceptually but not operational. Forge uses SDLC phase names similar to BMAD, but it does not write planning artifacts into `_bmad-output/`, read BMAD config, or invoke BMAD workflows.
- Brownfield support is missing. Forge assumes a generated target project rather than maintaining the current repo or an existing repo.
- Context broker is missing. Forge has budgeted phases, but not a retrieval layer that decides which files, symbols, memories, or artifacts to include.
- Model switching is implemented only as internal Anthropic routing. There is no user-facing `--model`, provider abstraction beyond Anthropic, or support for OpenAI/Codex yet.
- Tool approval is basic. Shell is allowlisted, but there is no risk-level policy, user approval prompt, or MCP permission model.
- Deployment path is missing. No infrastructure planning, environment config, CI/CD, Azure/cloud deployment, or deployment handoff exists yet.
- End-to-end scaffold coverage is narrow. Forge can generate runnable projects, but does not explicitly plan data structure, design system, UI/UX, backend, infrastructure, and deployment as separate scaffold domains.
- Run state is local and user-specific. This is good for audit history, but the PRD must define what belongs in local run state versus repo artifacts versus Serena memories.

### Recommended Product Direction

Forge should become the implementation base for the Agentic Workflow CLI Harness. The product should evolve in layers:

1. Stabilize Forge v0.1 as a greenfield prompt-to-project runner.
2. Add context detection and BMAD artifact awareness.
3. Add Serena MCP as the semantic project intelligence layer.
4. Add MCP registry/discovery and tool risk metadata.
5. Add brownfield workflows for inspect, plan, work, review, and context refresh.
6. Add explicit scaffold domains: data, UX/design system, frontend, backend, infrastructure, deployment.
7. Add provider-agnostic model routing and manual model overrides.
8. Add deployment planning and approval-gated deployment execution.

### Candidate v0.2 Requirements

- `forge status`: show Git, BMAD, Serena, MCP, model, and run-state status.
- `forge context refresh`: summarize repo/project context and write durable context artifacts.
- `forge mcp list`: show configured MCP servers and exposed tools.
- `forge mcp health`: validate MCP availability.
- `forge inspect <topic>`: use Serena to inspect symbols/files relevant to a topic.
- `forge plan --bmad "<prompt>"`: write BMAD-compatible planning artifacts before execution.
- `forge work "<request>"`: route a brownfield request through plan, inspect, implement, verify, review.
- `forge design data|ux|backend|infra`: produce scaffold-domain plans before file generation.
- `forge model set <model>` and `forge new --model <model>`: allow manual override.
- Tool calls should include risk classification and approval policy.

### v0.2 Implementation Progress

Implemented first foundation slice:

- Added project context detection for Git, branch, BMAD, Serena, Forge, and package manager.
- Added MCP registry and health detection with auto-detected Serena stdio configuration.
- Added `forge status`.
- Added `forge context refresh` that writes a portable BMAD context artifact.
- Added `forge mcp list` and `forge mcp health`.
- Added `forge inspect <topic>` placeholder that reports project context and Serena readiness.
- Added `forge design <domain> <prompt>` for BMAD scaffold-domain artifacts.
- Added `forge work <request>` for brownfield work-plan artifact scaffolding.
- Added `--model`, `--context-budget`, and `--bmad` flags to `forge new` and `forge plan`.
- Added BMAD-compatible plan artifact writing for plan runs.
- Preserved existing Forge greenfield execution flow.

### v0.3 Chat-First Interaction Progress

Forge now starts as an interactive chat harness when run without a subcommand or with `forge chat`.

- Plain text routes to the selected model for direct conversation with compact project context.
- `/request <text>` captures a project idea without invoking a model.
- `/plan` and `/new` can use the captured request or an inline prompt.
- Slash commands expose the existing operations: `/status`, `/context`, `/mcp`, `/inspect`, `/design`, `/work`, `/models`, `/runs`, `/log`, `/cost`, and `/resume`.
- Chat defaults can be changed with `/set target-dir`, `/set model`, `/set coder`, `/set context-budget`, `/set bmad`, and `/set skip-doctor`.
- Existing Commander subcommands remain available for scripts and CI.

Still pending:

- Live MCP client execution and tool discovery.
- Serena semantic tool calls for symbol lookup, references, diagnostics, and memories.
- Full ContextBroker with token-aware retrieval and context selection rationale.
- Approval/risk policy integrated into actual tool execution.
- Provider-agnostic model clients beyond Anthropic.
- Brownfield implementation execution beyond planning artifact generation.
- Deployment planning and deployment handoff.

### Product Decisions Implied by Current State

- First implementation stack is TypeScript/Node 20.
- The working product name is Forge.
- The first implemented model provider is Anthropic.
- The first implemented persistence layer is local filesystem run state.
- The first implemented execution mode is CLI-only.
- The current model routing pattern is deterministic rules with escalation, not an LLM planner.
