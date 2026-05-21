---
title: "Product Brief: Agentic Workflow CLI Harness"
status: draft-updated-with-forge-baseline
created: 2026-05-21
updated: 2026-05-21
---

# Product Brief: Agentic Workflow CLI Harness

## Executive Summary

The Agentic Workflow CLI Harness is a context-aware command-line system for creating, maintaining, and evolving software projects with AI agents. It combines BMAD's structured product-development framework with Serena MCP's semantic codebase intelligence so users can move from idea to deployable project through guided workflows instead of fragmented prompts.

The harness is intended to support both greenfield and brownfield work. For new projects, it should guide users end-to-end from product intent through data-structure design, design systems, UI/UX, backend architecture, infrastructure planning, and deployment readiness. For existing projects, it should understand the active repository, available tools, existing architecture, project memories, and current BMAD phase before proposing changes.

The strategic goal is to reduce wasted tokens and wasted engineering cycles. Instead of sending entire repositories or large documents to a model, the harness should retrieve only the right context, choose the right model for the task, expose only relevant tools, and persist durable decisions as project knowledge.

## The Problem

AI coding tools are powerful, but most workflows remain prompt-driven and context-fragile. Users repeatedly explain the same product intent, reattach the same files, re-discover the same architecture, and manually decide which agent, model, or tool should handle each step. This creates drift, high token usage, inconsistent planning quality, and brittle handoffs between product, design, backend, infrastructure, and deployment work.

Greenfield project creation is especially fragmented. A user might ask for a frontend, then separately ask for database design, then separately ask for infrastructure. The result often lacks a coherent product spine, design-system consistency, realistic backend boundaries, or deployment path.

Brownfield maintenance has a different failure mode. Agents often lack durable project memory and semantic awareness. They over-read files, miss existing conventions, duplicate functionality, or make changes without understanding current architecture, Git state, available MCP tools, or previously accepted product decisions.

## The Solution

Build a CLI harness that acts as the user's agentic control plane. The harness should detect the active project or topic, understand available MCP servers and tools, route work through BMAD workflows, use Serena for semantic code intelligence, and select appropriate models based on task type and token budget.

Forge v0.1 is the current starting point for this harness. It already provides a TypeScript/Node CLI that accepts a prompt, classifies the project, builds a phase plan, routes phases across Anthropic Haiku/Sonnet/Opus, executes sub-agents with local file/shell tools, records audit/cost metadata, and supports dry-run planning and resume. The next product step is not to restart from scratch, but to evolve Forge from a prompt-to-project builder into a context-aware workflow harness.

For a new project, the harness should guide a user through a coherent lifecycle:

- Product framing and BMAD brief/PRD creation.
- Data model and data-structure design.
- Design-system and UX direction.
- Frontend application design and scaffold.
- Backend/API design and scaffold.
- Infrastructure and deployment design.
- MCP integration planning.
- Deployment execution or deployment handoff.

For an existing project, the harness should:

- Detect repo context, Git branch, project config, BMAD artifacts, and Serena project state.
- Load concise project summaries instead of entire source trees.
- Use Serena MCP for symbol lookup, references, diagnostics, and memories.
- Route work into maintenance workflows such as feature planning, bug investigation, refactoring, code review, or deployment readiness.

## Current Forge Baseline

Forge currently exists as a working v0.1 CLI under `forge/`.

Implemented capabilities:

- `forge new "<prompt>"` creates a target project from a natural-language prompt.
- `forge plan "<prompt>"` performs a dry-run plan without execution.
- `forge resume <run-id>` resumes from a saved run plan.
- `forge models` lists the model registry.
- `forge log <run-id>`, `forge cost <run-id>`, and `forge runs` expose run history and audit/cost data.
- Prompt classification runs on Haiku and outputs project type, complexity, estimated files, UI requirement, stack hint, ambiguity score, and summary.
- The orchestrator builds a fixed SDLC plan with phases: brief, architecture, stories, implementation, verify, review.
- The router selects Haiku/Sonnet/Opus based on phase, complexity, and ambiguity, with an escalation ladder.
- Sub-agents run against a scoped target directory with allowlisted tools: read file, write file, edit file, list files, and shell.
- Run state persists under `~/.forge/runs/<id>/` or `FORGE_HOME`.

Important limitations:

- Model support is Anthropic-only despite the broader model-switching goal.
- MCP support is not implemented yet; current tools are direct local tools.
- Serena MCP is not wired into Forge for semantic code lookup, memories, diagnostics, or onboarding.
- BMAD artifacts are not generated in BMAD directories during Forge runs; Forge writes generated-project docs into the target project.
- Brownfield maintenance workflows are not implemented; Forge is currently greenfield-oriented.
- Deployment is not implemented beyond producing a runnable project.
- Approval policy for shell/tool/deployment actions is minimal.
- Context budgeting exists through phase budgets, but there is no context broker that explains or optimizes retrieved context.

## What Makes This Different

The harness is not just another chat wrapper. Its value is in orchestration, context discipline, and workflow memory.

Key differentiators:

- BMAD as the workflow spine: planning, PRD, architecture, epics, stories, review, and delivery remain explicit.
- Serena as the code intelligence layer: semantic lookup replaces broad file dumping.
- MCP-first extensibility: users can connect project-specific tools such as GitHub, Azure DevOps, cloud providers, databases, observability platforms, design tools, or custom business systems.
- Model routing: the harness can switch between low-cost, high-speed, coding, reasoning, and review models based on task needs.
- Token budget enforcement: the harness should make context selection visible and intentional.
- Project/topic awareness: users can run the harness against a repo, a product idea, a feature topic, or a deployment target.
- End-to-end scaffold path: product, data, design, frontend, backend, infrastructure, and deployment are treated as one connected workflow.

## Who This Serves

Primary users are builders who want to create or evolve real software projects with strong AI assistance but without losing architectural coherence. This includes solo founders, product engineers, technical leads, consultants, and small teams.

Secondary users are teams standardizing internal AI-assisted delivery. They need repeatable workflows, agent/tool governance, lower model spend, and durable project memory across sessions.

The ideal user wants more than code generation. They want a system that helps them reason, plan, scaffold, modify, review, and deploy with continuity.

## Success Criteria

The first successful version should demonstrate:

- A user can initialize the harness in a new or existing repository.
- The harness can detect BMAD and Serena project context.
- The harness can list available MCP servers/tools and expose them to the user.
- The harness can route a product idea into an initial BMAD planning flow.
- The harness can maintain topic/project context across commands.
- The harness can switch models manually and recommend models automatically.
- The harness can show what context it selected and why.
- The harness can create a scoped project scaffold plan covering data, design, frontend, backend, infrastructure, and deployment.
- The harness avoids committing local paths, secrets, or machine-specific configuration into project artifacts.
- Forge can preserve its existing prompt-to-project flow while adding context-aware project detection.
- Forge can run in a "plan only" mode that produces BMAD-compatible planning artifacts before code generation.
- Forge can distinguish greenfield creation from brownfield maintenance and route accordingly.

Longer-term success should be measured by:

- Reduced repeated context in user prompts.
- Reduced token usage per meaningful task.
- Higher consistency between PRD, architecture, stories, and implementation.
- Faster new-project scaffold time.
- Safer brownfield modifications.
- Repeatable deployment preparation across projects.

## Scope

### Initial Version

The initial version now has a Forge v0.1 implementation baseline. The next scoped version should focus on turning that baseline into a context-aware harness before expanding automation.

In scope:

- Preserve the existing `forge new`, `forge plan`, `forge resume`, `forge models`, `forge log`, `forge cost`, and `forge runs` flow.
- Add project/topic context detection.
- Add BMAD artifact awareness and BMAD-compatible output paths.
- Add Serena MCP health/context integration.
- Add MCP registry and tool discovery model.
- Extend manual and policy-based model switching beyond Anthropic-only routing.
- Add explicit token/context-budget modes.
- Add new-project workflow planning that covers product, data, UX, backend, infrastructure, and deployment.
- Add existing-project maintenance workflow planning.
- Portable configuration model.
- Initial scaffold planner that can produce an approved plan before generating files.
- Approval gates for high-risk shell, file, MCP, and deployment actions.

### Explicitly Out of Scope for Initial Version

- Fully autonomous deployment execution without user approval.
- Full visual design generation beyond structured UX/design-system planning.
- Cloud-provider lock-in.
- Hard-coded assumptions about one frontend or backend stack.
- Secret storage beyond references to approved secure mechanisms.
- Replacing BMAD or Serena; the harness coordinates them.
- Hosted/multi-tenant execution.
- GUI or browser-based project canvas.
- Autonomous production deployment.

## Platform and Integration Direction

The harness should become MCP-native. MCP support is a foundational capability, not an add-on. Users should be able to connect different MCP servers based on the project context. Forge v0.1 currently uses direct local tools; MCP integration is a required next step.

Likely MCP integration categories:

- Code intelligence: Serena.
- Source control: GitHub, Azure DevOps.
- Cloud and deployment: Azure, container registries, hosting platforms.
- Data: Postgres/Neon, SQL Server, vector stores, storage providers.
- Product/design: issue trackers, docs, design-system repositories.
- Communication: Slack, email, notification providers.
- Observability: Application Insights, logs, metrics, tracing.

The harness should maintain a tool registry that records:

- Tool name.
- MCP server source.
- Capabilities.
- Required permissions.
- Project relevance.
- Risk level.
- Whether user approval is required.

## Early Workflow Shape

Example greenfield flow:

1. `forge status` detects or creates project context.
2. `forge plan "build X"` creates or updates BMAD planning artifacts.
3. `forge design data` proposes domain entities, relationships, validation rules, and persistence choices.
4. `forge design ux` proposes design-system foundations and core user journeys.
5. `forge design backend` proposes APIs, services, auth, background jobs, and integration boundaries.
6. `forge design infra` proposes deployment topology, environments, configuration, secrets, monitoring, and cost posture.
7. `forge new "build X"` or `forge scaffold` creates an approved project skeleton.
8. `forge deploy plan` prepares deployment steps or hands off to a deployment MCP/tool.

Example brownfield flow:

1. `forge status` reads Git, BMAD, Serena, and MCP state.
2. `forge context refresh` updates summaries and memories.
3. `forge work "add feature X"` routes to BMAD feature planning or story execution.
4. `forge inspect "area Y"` uses Serena semantic lookup.
5. `forge review` performs scoped code review with known project context.

## Open Questions

- Should Forge remain the product name, or should it become the implementation codename under a broader harness name?
- Which model providers should be supported next after Anthropic?
- Should the harness remain a pure CLI, or introduce a daemon-backed MCP/session runtime later?
- How should user approvals be represented for tool calls and deployment actions?
- What is the minimum useful scaffold output for v0.2: BMAD plan-only, generated files, or runnable app with infrastructure plan?
- Should project memory live only in repo files, in Serena memories, or in a separate harness store as well?
- How much of BMAD should be invoked directly versus represented as Forge-native workflow commands?
- What is the first target deployment platform?
- How should MCP server configuration be stored without committing secrets or machine-specific paths?

## Vision

If successful, the Agentic Workflow CLI Harness becomes a portable AI delivery cockpit. A user can point it at a concept or repository, connect the MCPs they trust, choose their model policy, and drive a coherent path from product idea to working system.

Over time, it should become a reusable operating layer for agentic software development: one that preserves context, respects project structure, reduces token waste, supports multiple models and tools, and gives users a controlled path from planning through deployment.
