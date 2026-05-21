# Serena setup

## Config

- `.serena/project.yml` — project name `betterharvest`, TypeScript + C# language servers enabled.
- `.serena/serena.sh` — repo-local launcher using `uvx` with a repository-local cache so separate repos don't share state.
- `.serena/serena-hooks.sh` — hooks launcher.

## How Forge sees Serena

Forge auto-detects Serena when `.serena/project.yml` exists.

`forge mcp list` auto-registers a stdio server:

```
name: serena
type: stdio
command: .serena/serena.sh
args: ["start-mcp-server", "--project-from-cwd", "--context=forge"]
risk: medium
source: auto:.serena/project.yml
```

`forge inspect <topic>` notes Serena availability but does not yet make live MCP tool calls — that's v0.4 work.

## Languages

Add more in `.serena/project.yml`. The file's commented header lists supported languages. For TypeScript projects use `typescript` (covers JS too). For C# default is `csharp` (alternative `csharp_omnisharp`).

## Memories

Live in `.serena/memories/`. See `docs/serena/memories.md` for conventions:

- One file per memory, kebab-case, `.md`.
- Title as `# H1`, then 1–2 sentence summary, then detail.
- Cover the **why**, not just the what.
- Project-relative paths, never absolute.
- Update when reality changes; delete when no longer true.
