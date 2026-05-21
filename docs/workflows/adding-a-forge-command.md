# Recipe — Adding a Forge command

Concrete steps. Targets [`forge/src/cli.ts`](../../forge/src/cli.ts).

## 1. Pick a home for the logic

| Logic shape | Goes in |
| --- | --- |
| Reads project / MCP state | [`forge/src/project/commands.ts`](../../forge/src/project/commands.ts) |
| Writes BMAD artifacts | [`forge/src/bmad/artifacts.ts`](../../forge/src/bmad/artifacts.ts) |
| Talks to a CLI adapter | [`forge/src/cli-adapters/`](../../forge/src/cli-adapters/) |
| Run state (audit / plan / checkpoints) | [`forge/src/run/state.ts`](../../forge/src/run/state.ts) |
| Plan structure / phases | [`forge/src/agents/`](../../forge/src/agents/) |

If none fit cleanly, create a new module under `forge/src/<area>/`.

## 2. Add types

If the command introduces new shapes (config, result, status row), add them to [`forge/src/types.ts`](../../forge/src/types.ts). Keep types narrow.

## 3. Implement the logic

Pure-ish function. Side-effects (fs, child_process) localized. Example skeleton:

```ts
// forge/src/project/commands.ts
export function buildToolsListText(cwd = process.cwd()): string {
  const ctx = detectProjectContext(cwd);
  const servers = discoverMcpServers(ctx);
  // ...
  return text;
}
```

## 4. Wire the CLI command

In [`forge/src/cli.ts`](../../forge/src/cli.ts), follow the existing commander pattern:

```ts
program
  .command("tools")
  .description("List tools exposed by configured MCP servers")
  .action(() => {
    console.log(buildToolsListText());
  });
```

For commands with arguments or flags:

```ts
program
  .command("tools")
  .argument("[server]", "filter by MCP server name")
  .option("--risk <level>", "filter by risk level (low|medium|high)")
  .action((server: string | undefined, opts: { risk?: string }) => {
    console.log(buildToolsListText({ server, risk: opts.risk }));
  });
```

## 5. Build and smoke-test

```bash
cd forge
npm run typecheck
npm run build
node dist/cli.js tools
```

## 6. Document

- Add the command to [docs/forge/cli-reference.md](../forge/cli-reference.md) (under the right section, with flags table).
- Update [forge/README.md](../../forge/README.md) usage section if it's user-prominent.
- Add a [changelog](../changelog.md) entry under "Unreleased".

## 7. Update agent guidance if conventions shifted

If the new command changes how agents are expected to operate (e.g. "always run `forge tools` before suggesting MCP integrations"), update:

- [`AGENTS.md`](../../AGENTS.md)
- [`CLAUDE.md`](../../CLAUDE.md)
- [`CODEX.md`](../../CODEX.md)
- [`.github/copilot-instructions.md`](../../.github/copilot-instructions.md)

## 8. Save a Serena memory (if it's a convention)

If the command becomes part of standard workflow, add a memory under `.serena/memories/` and list it in [docs/serena/memories.md](../serena/memories.md).

## Common pitfalls

- **Forgetting `--skip-doctor`-style escape hatches** for testing on machines without the underlying CLIs. Match the pattern in existing commands.
- **Absolute paths in output.** Use `formatProjectContext(ctx, { portable: true })` for any string written to a committed file.
- **No CLI version bump.** If you change the user-visible surface meaningfully, bump the version string in [`cli.ts`](../../forge/src/cli.ts) and `forge/package.json`.
- **No changelog.** Future you will not remember why the command exists. Write it down.
