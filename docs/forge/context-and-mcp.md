# Context and MCP

How Forge detects the active project and which tool servers are available.

## Project context detection

Source: [forge/src/project/context.ts](../../forge/src/project/context.ts).

`detectProjectContext()` walks the filesystem and returns:

| Field | Detection method |
| --- | --- |
| `cwd` | `process.cwd()` |
| `projectRoot` | `git rev-parse --show-toplevel`, falling back to nearest ancestor containing `_bmad/`, falling back to `cwd` |
| `gitRoot` | `git rev-parse --show-toplevel` |
| `branch` | `git branch --show-current` |
| `hasBmad` | `_bmad/` exists at project root |
| `hasSerena` | `.serena/project.yml` exists |
| `hasForge` | `forge/package.json` or `package.json` exists |
| `bmadPlanningDir` | `_bmad-output/planning-artifacts/` when BMAD present |
| `serenaProjectFile` | `.serena/project.yml` when Serena present |
| `packageManager` | `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, otherwise npm if any `package.json`/`package-lock.json` |

Surface this from the CLI:

```bash
forge status            # human-readable
forge context refresh   # write portable artifact under _bmad-output/.../forge-context/
```

## Portable vs. local mode

`formatProjectContext(ctx, { portable: true })` replaces the absolute `projectRoot` with `.` and collapses `gitRoot` to `.` when it equals the project root. **Always use portable mode for committed artifacts** — otherwise the artifacts carry your local `/Users/<you>/...` paths.

`forge context refresh` and `forge status` (in artifact contexts) use portable mode by default.

## MCP registry

Source: [forge/src/mcp/registry.ts](../../forge/src/mcp/registry.ts).

`discoverMcpServers(ctx)` merges servers from:

1. **Auto-detected Serena** — if `.serena/serena.sh` exists, registers a stdio server:
   ```json
   {
     "name": "serena",
     "type": "stdio",
     "command": ".serena/serena.sh",
     "args": ["start-mcp-server", "--project-from-cwd", "--context=forge"],
     "risk": "medium",
     "source": "auto:.serena/project.yml"
   }
   ```
2. **Config files** (in this order, last write wins on name conflict):
   - `forge.mcp.json` at project root
   - `.forge/mcp.json`
   - `.mcp.json`

Each config file uses the shape:

```json
{
  "servers": [
    {
      "name": "github",
      "type": "http",
      "url": "https://mcp.example.com/github",
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

Defaults: `type` inferred from presence of `url`, `enabled = true`, `risk = "medium"`.

## Health checks

`checkMcpHealth(ctx, server)` validates per server:

- Disabled → `WARN disabled`.
- `http` → ok if `url` set.
- `stdio` → ok if `command` looks resolvable (relative path exists on disk, or absolute/bare command name).

CLI:

```bash
forge mcp list      # configured servers
forge mcp health    # OK / WARN per server
```

## Adding an MCP server

1. Decide if it's user-config (most cases) or auto-detect (only for repo-bundled local servers like Serena).
2. Add to `forge.mcp.json` with appropriate `risk` (`low | medium | high`).
3. Verify with `forge mcp health`.

## Live tool execution (roadmap)

Today, the registry **discovers** servers but Forge sub-agents still use only their local file/shell tools — actual MCP tool calls are roadmap (v0.4). When live MCP execution lands:

- Serena tool calls (`find_symbol`, `find_referencing_symbols`, `read_memory`, `write_memory`) become available to the sub-agent.
- The risk field gates user approval prompts for `high`-risk tool calls.
- A context broker decides which tool outputs to include in the next prompt and surfaces the rationale.

See [../roadmap.md](../roadmap.md).
