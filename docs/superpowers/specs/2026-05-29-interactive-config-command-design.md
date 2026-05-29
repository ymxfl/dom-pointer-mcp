# Interactive `config` command

## Background

Today `mcp-pointer config <tool> [--scope user|project]` requires the user to know the tool ID, run the command once per agent, and remember the `--scope` flag. There is no built-in way to undo an install — users have to hand-edit `~/.mcp.json`, delete files under `~/.claude/`, run `claude mcp remove`, etc., per agent.

This spec adds an interactive flow when `config` is invoked with no positional tool, and a symmetric uninstall path. The non-interactive form keeps working unchanged for scripts and CI.

## CLI shape

```
mcp-pointer config                                       # interactive (new default)
mcp-pointer config <tool> [--scope user|project]         # legacy install (unchanged)
mcp-pointer config --uninstall <tool> [--scope user|project]  # non-interactive uninstall
```

- Interactive mode is entered only when no positional `<tool>` is given **and** stdin is a TTY. If `!isTTY` and no `<tool>`, print usage and exit 1 (same as today's `showAvailableTools`).
- `--uninstall` without `<tool>` enters the interactive uninstall flow (TTY required).
- `--scope` is honoured in the non-interactive paths only. In interactive mode the scope question is always asked.

## Interactive install flow

1. `select` Action — `Install` / `Uninstall`. (Top-level menu is the entry to uninstall.)
2. `checkbox` Agents — list all 6 adapters with their display names. Space toggles, enter confirms. Validation: at least one must be selected.
3. `select` Scope — `user` (global) / `project` (current directory only).
4. `confirm` Slash command — single y/N applied to all selected agents. Default `Yes`.
5. Execute: for each selected agent, in order, call `registerMcp`, `installSkill` (if defined), and `installCommand` only if the user said yes to slash. Print results using the existing `printResult` shape.

Exit code: `1` if any operation returns `status: 'failed'`; otherwise `0`. Degraded/skipped do not fail the run (matches today's behaviour).

### Scope conflicts

Existing per-tool scope constraints (windsurf MCP is user-only, joycode prompt is project-only, codex prompt is user-only) continue to surface as `status: 'degraded'` results from the adapters themselves. The interactive flow does **not** filter agents based on the chosen scope; it just runs each adapter and lets the result line explain what happened.

## Interactive uninstall flow

Uninstall is **user-scope only** in the interactive flow. Rationale: project-scope installs live in arbitrary directories that the CLI cannot reliably discover from the current cwd. Forcing scope selection here would imply we can find project installs, which we can't.

1. `checkbox` Agents — same list as install. Validation: at least one.
2. `confirm` Warning:
   ```
   This will remove MCP entries, skills, and slash commands installed at user scope
   for: Claude Code, Cursor.
   Project-scope installs must be removed manually.
   Continue? (y/N)   ← default No
   ```
3. Execute: for each agent, call `unregisterMcp('user')`, `uninstallSkill?.('user')`, `uninstallCommand('user')`. Print results.
4. End-of-run hint:
   ```
   💡 To remove project-scope installs, cd into the project and run:
      mcp-pointer config --uninstall <tool> --scope project
   ```

Non-interactive uninstall (`--uninstall <tool> --scope ...`) honours whatever scope is passed.

## Adapter contract changes

`ToolAdapter` (`packages/server/src/config/types.ts`) gains three symmetric methods:

```ts
export interface ToolAdapter {
  toolId: ToolId;
  displayName: string;
  registerMcp(scope, port): Promise<OperationResult>;
  installCommand(scope): Promise<OperationResult>;
  installSkill?(scope): Promise<OperationResult>;

  unregisterMcp(scope: Scope): Promise<OperationResult>;
  uninstallCommand(scope: Scope): Promise<OperationResult>;
  uninstallSkill?(scope: Scope): Promise<OperationResult>;
}
```

Rules for every `uninstall*` / `unregister*` method:

- **Idempotent.** If the target file or JSON key does not exist, return `{ status: 'skipped', message: 'nothing to remove' }`. Never error on "already gone".
- **Surgical.** When removing the `pointer` MCP server from a multi-key structured config (JSON files like `.mcp.json`, `~/.cursor/mcp.json`, or the codex TOML config), delete only the `pointer` entry. Leave other keys untouched.
- **Never delete user files.** If removing our entry leaves an empty document (`{}` for JSON, an empty `[mcp_servers]` table for TOML), write the empty document back rather than `unlink` the file. Some tools may treat absence as "never configured" and rewrite defaults.
- **Claude MCP user scope.** Reuse `claude mcp remove pointer -s user` via `execSync`. Swallow "not installed" errors and return `skipped`.
- **Skill / slash files.** `rm` the single file we wrote (`~/.claude/skills/<TRIGGER_NAME>/SKILL.md`, `~/.claude/commands/<TRIGGER_NAME>.md`, etc.). Do not remove the parent directory even if it becomes empty — same "never delete user dirs" principle.

## Code layout

New / changed files in `packages/server/src/`:

- **`config/prompts.ts`** (new). Thin wrappers around `@inquirer/prompts`: `selectAction()`, `selectAgents(adapters)`, `selectScope()`, `confirmSlash()`, `confirmUninstall(agentNames, scope)`. Pure I/O. Throws if `!process.stdin.isTTY`.
- **`config.ts`**. Refactor `configCommand(tool, opts)` so the existing single-tool install path is one branch. Add `runInteractiveInstall()`, `runInteractiveUninstall()`, and a shared `executeForAgents(adapters, mode, scope, withSlash)` that does the per-agent loop and prints results. Exit code logic stays in one place.
- **`config/adapters/*.ts`**. Each of the six adapters gets the three new methods. Existing install methods unchanged.
- **`config/adapters/index.ts`**. No change (adapters list stays the same).
- **`cli.ts`**. Update the `config` command registration:
  - Keep `[tool]` optional.
  - Add `--uninstall` boolean flag.
  - Route: `--uninstall && tool` → non-interactive uninstall; `--uninstall && !tool` → interactive uninstall; `!--uninstall && !tool` → interactive install; `!--uninstall && tool` → legacy install.

The `--scope` flag is parsed once at the CLI layer and passed through unchanged.

## Dependencies

Add `@inquirer/prompts` to `packages/server/dependencies`. It is MIT, actively maintained (npm uses it), and esbuild bundles it into the existing `dist/cli.cjs` so end users see no install-time change. Approximate bundle delta: ~30 KB minified.

## Testing

- **Adapter unit tests (new).** For each adapter, add `unregisterMcp` / `uninstallCommand` / `uninstallSkill` cases covering:
  - target file does not exist → `skipped`
  - file exists, our entry is absent → `skipped`, file unchanged
  - file exists with our entry + other entries → entry removed, others preserved
  - file exists with only our entry → file written back as an empty document (`{}` for JSON, empty table for TOML)
  - parse error → `failed`, file untouched
- **Orchestrator integration test (new).** Drive `executeForAgents` with two stub adapters (one all-success, one with a `degraded` and a `failed`) and assert: per-agent rendering order, the aggregate exit-code logic, and that `installCommand` is skipped when `withSlash=false`.
- **Interactive prompts.** Not unit-tested — covered by manual smoke (`pnpm --filter @mcp-pointer/server dev config`).
- Existing install-path adapter tests stay green unchanged.

## Out of scope

- Discovery of project-scope installs across the filesystem. (Why: ambiguous, slow, and risky — would need to traverse user home looking for `.mcp.json` files. The end-of-run hint covers this.)
- Per-agent scope selection. (Why: the chosen flow uses one scope for the whole batch; the trade-off is accepted in favour of fewer questions.)
- Migration of pre-existing installs that used different naming conventions. (Why: the current adapters have only ever written `MCP_SERVER_NAME = 'pointer'`; nothing else to clean up.)
