# MCP and project context

## Project context (forge/src/project/context.ts)

`detectProjectContext()` returns:

- `cwd`, `projectRoot` (git root → ancestor with `_bmad/` → cwd), `gitRoot`, `branch`
- `hasBmad` (`_bmad/` exists), `hasSerena` (`.serena/project.yml` exists), `hasForge` (`forge/package.json` or `package.json` exists)
- `bmadPlanningDir` (`_bmad-output/planning-artifacts/` when BMAD present)
- `serenaProjectFile`
- `packageManager` (`pnpm-lock.yaml` → pnpm; `yarn.lock` → yarn; otherwise npm if any package.json present)

`formatProjectContext(ctx, { portable: true })` collapses absolute paths to `.` — **always use portable mode for committed artifacts**.

## MCP registry (forge/src/mcp/registry.ts)

`discoverMcpServers(ctx)` merges:

1. **Auto-detected Serena** if `.serena/serena.sh` exists.
2. **Config files** (last write wins on name conflict):
   - `forge.mcp.json` at project root
   - `.forge/mcp.json`
   - `.mcp.json`

Config shape:

```json
{
  "servers": [
    {
      "name": "github",
      "type": "http",
      "url": "https://...",
      "enabled": true,
      "risk": "high"
    },
    {
      "name": "postgres",
      "type": "stdio",
      "command": "./scripts/pg-mcp.sh",
      "args": [],
      "enabled": true,
      "risk": "high"
    }
  ]
}
```

Defaults: `type` inferred from presence of `url`, `enabled=true`, `risk="medium"`.

## Health checks

`checkMcpHealth(ctx, server)`:

- Disabled → WARN.
- `http` → OK if `url` set.
- `stdio` → OK if `command` resolvable (relative path exists, or absolute/bare command name).

## Current limitations

- Registry **discovers** servers but Forge sub-agents still only use local file/shell tools.
- Live MCP tool execution is v0.4 roadmap (Serena `find_symbol`, `read_memory`, etc., plus tool-call risk gating).
