# Workflow — Greenfield

End-to-end: idea → planned → scaffolded → runnable.

## When to use

You have a new product idea (no existing repo to maintain). You want a coherent path from concept through code without losing the product spine.

## Steps

### 1. Frame the concept (BMAD)

Use one of:

- `bmad-brainstorming` — open-ended ideation.
- `bmad-product-brief` — short structured brief.
- `bmad-prfaq` — Working Backwards PRFAQ.

Artifact lands in `_bmad-output/planning-artifacts/<topic>/`.

### 2. Write the PRD

`bmad-prd` — functional + non-functional requirements, scope, success criteria.

### 3. UX (when UI matters)

`bmad-create-ux-design` — patterns, journeys, design-system direction.

### 4. Architecture

`bmad-create-architecture` — technology choices, system boundaries, integration points, deployment direction.

### 5. Forge design pass per scaffold domain

Before generating code, write design artifacts so each domain is intentional:

```bash
forge design data     "<entities, relationships, persistence>"
forge design ux       "<design system, journeys>"
forge design backend  "<APIs, services, auth, jobs>"
forge design infra    "<deployment topology, envs, secrets, monitoring, cost>"
```

Each writes `_bmad-output/planning-artifacts/forge-design/<domain>-design.md`.

### 6. Epics and stories

`bmad-create-epics-and-stories` — break the PRD into stories.

### 7. Implementation readiness check

`bmad-check-implementation-readiness` — gate. PRD, UX, Architecture, Epics complete?

### 8. Generate the project

Dry-run first to inspect the plan:

```bash
forge plan "build <project>" --target-dir ../forge-out --bmad
```

When the plan looks right:

```bash
forge new "build <project>" --target-dir ../forge-out --bmad
```

The `--bmad` flag mirrors the plan into `_bmad-output/planning-artifacts/forge-runs/<run-id>/`.

### 9. Inspect the run

```bash
forge log <run-id>
forge cost <run-id>
```

### 10. Iterate

If a phase failed and escalation didn't recover, edit the plan and resume:

```bash
# Edit ~/.forge/runs/<id>/plan.json — adjust modelId
forge resume <run-id> --target-dir ../forge-out
```

### 11. Hand off to delivery

Use BMAD story-by-story execution for ongoing development on the generated repo:

`bmad-sprint-planning` → `bmad-create-story` → `bmad-dev-story` → `bmad-code-review`.

## Example: small CRUD app

```bash
# Inside the betterharvest repo
forge plan "build a CLI todo app in Python with SQLite persistence" \
  --target-dir ../forge-out --bmad

# Looks good — run it
forge new "build a CLI todo app in Python with SQLite persistence" \
  --target-dir ../forge-out --bmad

# Inspect
forge runs
forge log <id>
forge cost <id>
```

## Tips

- For very small projects (`complexity = S`) routing drops to Haiku for brief/stories automatically.
- For ambiguous prompts (`ambiguityScore > 0.7`), brief and arch escalate to Opus automatically — better to spend on planning than re-do impl.
- If you want everything on a specific model: `--model opus`. Verify still runs on the default to keep the cheap quality gate.
- Codex for impl with `--coder codex`.
