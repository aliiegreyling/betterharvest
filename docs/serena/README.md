# Serena in this repo

Serena is the **semantic code intelligence** layer. Instead of dumping files into a prompt, Serena exposes the codebase via MCP: symbol lookup, find references, diagnostics, durable memories.

## Configuration

- Project config: [`.serena/project.yml`](../../.serena/project.yml) (TypeScript + C# enabled).
- Repo-local launcher: [`.serena/serena.sh`](../../.serena/serena.sh) — uses `uvx` with a repository-local cache so different repos don't share state.
- Hook launcher: [`.serena/serena-hooks.sh`](../../.serena/serena-hooks.sh).

## Project detection in Forge

Forge auto-detects Serena by checking for `.serena/project.yml`. When present:

- `forge status` reports `Serena: yes`.
- `forge mcp list` shows an auto-detected Serena stdio server with command `.serena/serena.sh start-mcp-server --project-from-cwd --context=forge`.
- `forge inspect <topic>` notes that semantic lookup will be wired in once live MCP tool execution lands (roadmap v0.4).

## Memories

See [memories.md](memories.md) for conventions. Memories live in `.serena/memories/` and survive sessions. They're the durable knowledge layer for the AI — analogous to `docs/` but for the AI's working memory, not human reference docs.

## Pages

- [memories.md](memories.md) — what we save, how, and where.

## Useful commands (when Serena MCP is running)

These are the MCP tools we'll wire into Forge in v0.4:

- `find_symbol(name)` — locate a symbol by name across the project.
- `find_referencing_symbols(symbol)` — reverse references graph.
- `read_memory(name)` / `write_memory(name, content)` — durable memory CRUD.
- `get_symbols_overview(path)` — symbol table for a file or directory.
- `list_dir(path)` / `find_file(pattern)` — directory traversal.
- Diagnostics via the configured language server.

## Languages enabled

From `.serena/project.yml`:

- TypeScript (covers JS too).
- C# (default `csharp` LSP).

To enable more: edit `.serena/project.yml`, restart Serena. See the language list in the file's commented header.
