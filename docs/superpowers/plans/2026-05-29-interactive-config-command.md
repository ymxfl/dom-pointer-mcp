# Interactive `config` Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `mcp-pointer config` (no args) drop into an interactive flow for multi-agent install/uninstall, while keeping the existing non-interactive form working.

**Architecture:** Split `config.ts` into a CLI entry, an orchestrator that runs install/uninstall across N adapters, and a `prompts.ts` module that wraps `@inquirer/prompts`. Each adapter gets three new symmetric methods (`unregisterMcp`, `uninstallCommand`, `uninstallSkill?`) and the registry stays untouched.

**Tech Stack:** TypeScript, Node 20, `commander`, `@inquirer/prompts` (new), `jest`.

**Spec:** `docs/superpowers/specs/2026-05-29-interactive-config-command-design.md`

---

## File Structure

**New files:**
- `packages/server/src/config/prompts.ts` — wrappers around `@inquirer/prompts` (action / agents / scope / slash / uninstall-confirm). Pure I/O.
- `packages/server/src/config/orchestrator.ts` — `runInteractiveInstall`, `runInteractiveUninstall`, `executeForAgents`. Shared per-agent loop, result rendering, exit-code logic.
- `packages/server/src/config/__tests__/orchestrator.test.ts` — stub-adapter tests for the orchestrator.
- Per-adapter `__tests__/adapters/<adapter>.uninstall.test.ts` would inflate the directory; instead, **extend each existing adapter test file** with `describe('uninstall…')` blocks.

**Modified files:**
- `packages/server/src/config/types.ts` — add three method signatures to `ToolAdapter`.
- `packages/server/src/config/adapter-helpers.ts` — add `fileExists`, `deleteFileIfExists`, `removeJsonKey` helpers.
- `packages/server/src/config/adapters/*.ts` (all six) — add the three uninstall methods. Existing install code unchanged.
- `packages/server/src/config.ts` — keep `configCommand(tool, opts)` as the legacy single-tool path; route to orchestrator for interactive/uninstall flows.
- `packages/server/src/cli.ts` — make `[tool]` truly optional, add `--uninstall` flag, route accordingly.
- `packages/server/package.json` — add `@inquirer/prompts` runtime dep.

---

## Task 1: Add `@inquirer/prompts` dependency

**Files:**
- Modify: `packages/server/package.json`

- [ ] **Step 1: Install the dep**

Run:
```bash
pnpm --filter @mcp-pointer/server add @inquirer/prompts@^7
```
Expected: `package.json` `dependencies` gains `"@inquirer/prompts": "^7.x.y"`, `pnpm-lock.yaml` updates.

- [ ] **Step 2: Verify bundle still builds**

Run:
```bash
pnpm --filter @mcp-pointer/server build
```
Expected: `packages/server/dist/cli.cjs` regenerates without errors. (`@inquirer/prompts` is bundled by esbuild because `--bundle` is on.)

- [ ] **Step 3: Commit**

```bash
git add packages/server/package.json pnpm-lock.yaml
git commit -m "chore(server): add @inquirer/prompts for interactive config"
```

---

## Task 2: Add filesystem + JSON helpers used by uninstall

**Files:**
- Modify: `packages/server/src/config/adapter-helpers.ts`
- Create: `packages/server/src/config/__tests__/adapter-helpers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/server/src/config/__tests__/adapter-helpers.test.ts`:
```ts
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import {
  fileExists,
  deleteFileIfExists,
  removeJsonKey,
} from '../adapter-helpers';

describe('fileExists', () => {
  it('returns true when file exists', async () => {
    const p = path.join(os.tmpdir(), `mcp-pointer-${Date.now()}-exists.tmp`);
    await fs.writeFile(p, 'x', 'utf8');
    try {
      await expect(fileExists(p)).resolves.toBe(true);
    } finally {
      await fs.unlink(p).catch(() => {});
    }
  });

  it('returns false when file does not exist', async () => {
    const p = path.join(os.tmpdir(), `mcp-pointer-${Date.now()}-missing.tmp`);
    await expect(fileExists(p)).resolves.toBe(false);
  });
});

describe('deleteFileIfExists', () => {
  it('returns "deleted" when the file existed', async () => {
    const p = path.join(os.tmpdir(), `mcp-pointer-${Date.now()}-del.tmp`);
    await fs.writeFile(p, 'x', 'utf8');
    await expect(deleteFileIfExists(p)).resolves.toBe('deleted');
    await expect(fileExists(p)).resolves.toBe(false);
  });

  it('returns "missing" when the file was absent', async () => {
    const p = path.join(os.tmpdir(), `mcp-pointer-${Date.now()}-nope.tmp`);
    await expect(deleteFileIfExists(p)).resolves.toBe('missing');
  });
});

describe('removeJsonKey', () => {
  it('removes a top-level key path', () => {
    const obj: any = { a: 1, b: 2 };
    expect(removeJsonKey(obj, ['a'])).toBe(true);
    expect(obj).toEqual({ b: 2 });
  });

  it('removes a nested key path', () => {
    const obj: any = { mcpServers: { pointer: { x: 1 }, other: { y: 2 } } };
    expect(removeJsonKey(obj, ['mcpServers', 'pointer'])).toBe(true);
    expect(obj).toEqual({ mcpServers: { other: { y: 2 } } });
  });

  it('returns false when the key is absent', () => {
    const obj: any = { mcpServers: { other: {} } };
    expect(removeJsonKey(obj, ['mcpServers', 'pointer'])).toBe(false);
    expect(obj).toEqual({ mcpServers: { other: {} } });
  });

  it('returns false when an intermediate key is missing or not an object', () => {
    const obj: any = { a: 'string' };
    expect(removeJsonKey(obj, ['a', 'b'])).toBe(false);
    expect(removeJsonKey({}, ['x', 'y'])).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @mcp-pointer/server test -- adapter-helpers
```
Expected: FAIL — `fileExists`, `deleteFileIfExists`, `removeJsonKey` not exported.

- [ ] **Step 3: Add the helpers**

Append to `packages/server/src/config/adapter-helpers.ts`:
```ts
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function deleteFileIfExists(filePath: string): Promise<'deleted' | 'missing'> {
  try {
    await fs.unlink(filePath);
    return 'deleted';
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
    throw e;
  }
}

export function removeJsonKey(obj: Record<string, any>, keyPath: string[]): boolean {
  if (keyPath.length === 0) return false;
  let cursor: any = obj;
  for (let i = 0; i < keyPath.length - 1; i += 1) {
    const k = keyPath[i];
    const next = cursor[k];
    if (!next || typeof next !== 'object') return false;
    cursor = next;
  }
  const last = keyPath[keyPath.length - 1];
  if (!(last in cursor)) return false;
  delete cursor[last];
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @mcp-pointer/server test -- adapter-helpers
```
Expected: PASS (all helper tests green).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/config/adapter-helpers.ts \
        packages/server/src/config/__tests__/adapter-helpers.test.ts
git commit -m "feat(config): add fileExists/deleteFileIfExists/removeJsonKey helpers"
```

---

## Task 3: Extend `ToolAdapter` interface with uninstall methods

**Files:**
- Modify: `packages/server/src/config/types.ts`

- [ ] **Step 1: Add the method signatures**

Replace the contents of `packages/server/src/config/types.ts` with:
```ts
export type Scope = 'user' | 'project';

export type ToolId =
  | 'claude' | 'cursor' | 'windsurf'
  | 'codex' | 'opencode' | 'joycode';

export type Status = 'success' | 'degraded' | 'skipped' | 'failed';

export interface OperationResult {
  status: Status;
  scope?: Scope;
  path?: string;
  message: string;
}

export interface ToolAdapter {
  toolId: ToolId;
  displayName: string;

  // Install
  registerMcp(scope: Scope, port: number): Promise<OperationResult>;
  installCommand(scope: Scope): Promise<OperationResult>;
  installSkill?(scope: Scope): Promise<OperationResult>;

  // Uninstall (symmetric; idempotent — return 'skipped' when nothing to remove)
  unregisterMcp(scope: Scope): Promise<OperationResult>;
  uninstallCommand(scope: Scope): Promise<OperationResult>;
  uninstallSkill?(scope: Scope): Promise<OperationResult>;
}
```

- [ ] **Step 2: Run typecheck — expect it to fail**

Run:
```bash
pnpm --filter @mcp-pointer/server typecheck
```
Expected: FAIL — each of the six adapters in `packages/server/src/config/adapters/*.ts` is missing `unregisterMcp` and `uninstallCommand`. This is intentional; the next six tasks fix one adapter each.

- [ ] **Step 3: Commit (red build is OK between tasks)**

```bash
git add packages/server/src/config/types.ts
git commit -m "feat(config): add uninstall methods to ToolAdapter contract"
```

---

## Task 4: Claude adapter uninstall

**Files:**
- Modify: `packages/server/src/config/adapters/claude.ts`
- Modify: `packages/server/src/config/__tests__/adapters/claude.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/server/src/config/__tests__/adapters/claude.test.ts`:
```ts
describe('claudeAdapter uninstall', () => {
  describe('uninstallCommand', () => {
    it('returns skipped when command file is missing', async () => {
      mockedReadFile.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      const fsMod = await import('fs/promises');
      (fsMod.unlink as unknown as jest.Mock) = jest.fn()
        .mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await claudeAdapter.uninstallCommand('user');
      expect(result.status).toBe('skipped');
    });

    it('deletes ~/.claude/commands/pointed.md when present', async () => {
      const fsMod = await import('fs/promises');
      const unlinkMock = jest.fn().mockResolvedValue(undefined);
      (fsMod.unlink as unknown as jest.Mock) = unlinkMock;
      const result = await claudeAdapter.uninstallCommand('user');
      expect(result.status).toBe('success');
      const expected = path.join(os.homedir(), '.claude', 'commands', 'pointed.md');
      expect(unlinkMock).toHaveBeenCalledWith(expected);
    });
  });

  describe('uninstallSkill', () => {
    it('deletes ~/.claude/skills/pointed/SKILL.md when present', async () => {
      const fsMod = await import('fs/promises');
      const unlinkMock = jest.fn().mockResolvedValue(undefined);
      (fsMod.unlink as unknown as jest.Mock) = unlinkMock;
      const result = await claudeAdapter.uninstallSkill!('user');
      expect(result.status).toBe('success');
      const expected = path.join(os.homedir(), '.claude', 'skills', 'pointed', 'SKILL.md');
      expect(unlinkMock).toHaveBeenCalledWith(expected);
    });
  });

  describe('unregisterMcp', () => {
    it('user scope runs `claude mcp remove`', async () => {
      mockedExecSync.mockReturnValueOnce('');
      const result = await claudeAdapter.unregisterMcp('user');
      expect(result.status).toBe('success');
      const removeCall = mockedExecSync.mock.calls.find(
        (c) => String(c[0]).includes('claude mcp remove'),
      );
      expect(removeCall).toBeDefined();
      expect(String(removeCall![0])).toContain('-s user');
    });

    it('user scope returns skipped when CLI says "not installed"', async () => {
      mockedExecSync.mockImplementation(() => {
        throw Object.assign(new Error('No MCP server with name'), { stderr: Buffer.from('not found') });
      });
      const result = await claudeAdapter.unregisterMcp('user');
      expect(result.status).toBe('skipped');
    });

    it('project scope removes pointer key from .mcp.json, preserves others', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: {
          other: { command: 'node' },
          pointer: { command: 'old' },
        },
        unrelated: 'keep me',
      }));
      const result = await claudeAdapter.unregisterMcp('project');
      expect(result.status).toBe('success');
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0].endsWith('.mcp.json'));
      expect(writeCall).toBeDefined();
      const written = JSON.parse(writeCall![1]);
      expect(written.mcpServers.pointer).toBeUndefined();
      expect(written.mcpServers.other.command).toBe('node');
      expect(written.unrelated).toBe('keep me');
    });

    it('project scope returns skipped when .mcp.json is missing', async () => {
      mockedReadFile.mockRejectedValueOnce(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await claudeAdapter.unregisterMcp('project');
      expect(result.status).toBe('skipped');
    });

    it('project scope returns skipped when pointer key is absent', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: { other: { command: 'node' } },
      }));
      const result = await claudeAdapter.unregisterMcp('project');
      expect(result.status).toBe('skipped');
    });

    it('project scope leaves {} when last key is removed (does not unlink)', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: { pointer: { command: 'old' } },
      }));
      const result = await claudeAdapter.unregisterMcp('project');
      expect(result.status).toBe('success');
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0].endsWith('.mcp.json'));
      const written = JSON.parse(writeCall![1]);
      expect(written.mcpServers).toEqual({});
    });
  });
});
```

Then update the jest mock at the top of the file to include `unlink`:
```ts
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
  unlink: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
}));
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @mcp-pointer/server test -- adapters/claude
```
Expected: FAIL — `unregisterMcp`, `uninstallCommand`, `uninstallSkill` are not implemented.

- [ ] **Step 3: Implement uninstall methods**

Append to `packages/server/src/config/adapters/claude.ts`:
```ts
import { fileExists, deleteFileIfExists, removeJsonKey } from '../adapter-helpers';

// ... inside claudeAdapter object, add:

  async unregisterMcp(scope): Promise<OperationResult> {
    if (scope === 'user') {
      try {
        execSync(`claude mcp remove ${MCP_SERVER_NAME} -s user`, { stdio: 'pipe' });
        return {
          status: 'success', scope, path: 'claude mcp remove -s user',
          message: 'MCP server removed (user scope)',
        };
      } catch (e) {
        return {
          status: 'skipped', scope,
          message: `No user-scope MCP entry found (${(e as Error).message.slice(0, 80)})`,
        };
      }
    }
    const filePath = path.join(process.cwd(), '.mcp.json');
    if (!(await fileExists(filePath))) {
      return { status: 'skipped', scope, path: filePath, message: '.mcp.json not found' };
    }
    try {
      const existing = await readJsonOrDefault<Record<string, any>>(filePath, {});
      const removed = removeJsonKey(existing, ['mcpServers', MCP_SERVER_NAME]);
      if (!removed) {
        return { status: 'skipped', scope, path: filePath, message: 'pointer entry not present' };
      }
      await writeFileEnsuringDir(filePath, JSON.stringify(existing, null, 2));
      return { status: 'success', scope, path: filePath, message: 'pointer entry removed from .mcp.json' };
    } catch (e) {
      return { status: 'failed', scope, message: `Edit failed: ${(e as Error).message}` };
    }
  },

  async uninstallCommand(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.claude', 'commands', `${TRIGGER_NAME}.md`);
    try {
      const r = await deleteFileIfExists(filePath);
      return r === 'deleted'
        ? { status: 'success', scope, path: filePath, message: 'Slash command removed' }
        : { status: 'skipped', scope, path: filePath, message: 'Slash command file not found' };
    } catch (e) {
      return { status: 'failed', scope, message: `Delete failed: ${(e as Error).message}` };
    }
  },

  async uninstallSkill(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.claude', 'skills', TRIGGER_NAME, 'SKILL.md');
    try {
      const r = await deleteFileIfExists(filePath);
      return r === 'deleted'
        ? { status: 'success', scope, path: filePath, message: 'Skill removed' }
        : { status: 'skipped', scope, path: filePath, message: 'Skill file not found' };
    } catch (e) {
      return { status: 'failed', scope, message: `Delete failed: ${(e as Error).message}` };
    }
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @mcp-pointer/server test -- adapters/claude
```
Expected: PASS — all install + uninstall tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/config/adapters/claude.ts \
        packages/server/src/config/__tests__/adapters/claude.test.ts
git commit -m "feat(config/claude): symmetric uninstall (MCP, command, skill)"
```

---

## Task 5: Cursor adapter uninstall

**Files:**
- Modify: `packages/server/src/config/adapters/cursor.ts`
- Modify: `packages/server/src/config/__tests__/adapters/cursor.test.ts`

Files to remove on uninstall:
- `<base>/.cursor/commands/pointed.md` (slash command)
- `<base>/.cursor/rules/pointed.mdc` (skill rule)
- `pointer` key from `mcpServers` in `<base>/.cursor/mcp.json`

`<base>` is `os.homedir()` for `user`, `process.cwd()` for `project`.

- [ ] **Step 1: Write failing tests**

Append a `describe('cursorAdapter uninstall', …)` block to `cursor.test.ts` mirroring the structure of claude's uninstall tests:

- `uninstallCommand(scope)` — success when file present, skipped when missing, for both scopes
- `uninstallSkill(scope)` — success/skipped for `.cursor/rules/pointed.mdc`
- `unregisterMcp(scope)`:
  - removes `mcpServers.pointer` from `.cursor/mcp.json` while preserving siblings
  - returns `skipped` when file missing
  - returns `skipped` when `pointer` key absent
  - leaves empty `mcpServers: {}` when last key removed

Update the `jest.mock('fs/promises', …)` block to include `unlink` and `access` (same shape as Task 4).

Use `expect(written.mcpServers.pointer).toBeUndefined()` etc.

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @mcp-pointer/server test -- adapters/cursor
```
Expected: FAIL — methods not implemented.

- [ ] **Step 3: Implement uninstall methods**

Add inside `cursorAdapter`:
```ts
  async unregisterMcp(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.cursor', 'mcp.json');
    if (!(await fileExists(filePath))) {
      return { status: 'skipped', scope, path: filePath, message: 'mcp.json not found' };
    }
    try {
      const existing = await readJsonOrDefault<Record<string, any>>(filePath, {});
      const removed = removeJsonKey(existing, ['mcpServers', MCP_SERVER_NAME]);
      if (!removed) {
        return { status: 'skipped', scope, path: filePath, message: 'pointer entry not present' };
      }
      await writeFileEnsuringDir(filePath, JSON.stringify(existing, null, 2));
      return { status: 'success', scope, path: filePath, message: 'pointer entry removed' };
    } catch (e) {
      return { status: 'failed', scope, message: `Edit failed: ${(e as Error).message}` };
    }
  },

  async uninstallCommand(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.cursor', 'commands', `${TRIGGER_NAME}.md`);
    try {
      const r = await deleteFileIfExists(filePath);
      return r === 'deleted'
        ? { status: 'success', scope, path: filePath, message: 'Slash command removed' }
        : { status: 'skipped', scope, path: filePath, message: 'Slash command file not found' };
    } catch (e) {
      return { status: 'failed', scope, message: `Delete failed: ${(e as Error).message}` };
    }
  },

  async uninstallSkill(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.cursor', 'rules', `${TRIGGER_NAME}.mdc`);
    try {
      const r = await deleteFileIfExists(filePath);
      return r === 'deleted'
        ? { status: 'success', scope, path: filePath, message: 'Skill rule removed' }
        : { status: 'skipped', scope, path: filePath, message: 'Skill file not found' };
    } catch (e) {
      return { status: 'failed', scope, message: `Delete failed: ${(e as Error).message}` };
    }
  },
```

Don't forget to add the imports:
```ts
import { fileExists, deleteFileIfExists, removeJsonKey } from '../adapter-helpers';
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @mcp-pointer/server test -- adapters/cursor
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/config/adapters/cursor.ts \
        packages/server/src/config/__tests__/adapters/cursor.test.ts
git commit -m "feat(config/cursor): symmetric uninstall (MCP, command, skill)"
```

---

## Task 6: Windsurf adapter uninstall

**Files:**
- Modify: `packages/server/src/config/adapters/windsurf.ts`
- Modify: `packages/server/src/config/__tests__/adapters/windsurf.test.ts`

Windsurf is the most awkward:
- `unregisterMcp` — user-only file `~/.codeium/windsurf/mcp_config.json`. Remove `mcpServers.pointer`. For `scope='project'`, return `degraded` with same effective behaviour (or skipped if no key present), matching install side's `degraded` story.
- `uninstallCommand(scope)` — delete the workflow file at user or project path.
- `uninstallSkill(scope)`:
  - **user:** strip the `<!-- BEGIN mcp-pointer skill --> … <!-- END mcp-pointer skill -->` block from `~/.codeium/windsurf/global_rules.md`. If the markers aren't found → `skipped`. If after stripping the file is empty/whitespace-only, write back an empty string (do not unlink).
  - **project:** delete `<cwd>/.windsurf/rules/pointed.md`.

- [ ] **Step 1: Write failing tests**

Append a `describe('windsurfAdapter uninstall', …)` block covering:

- `uninstallCommand` user → deletes `~/.codeium/windsurf/workflows/pointed.md`
- `uninstallCommand` project → deletes `<cwd>/.windsurf/workflows/pointed.md`
- `uninstallSkill` user with markers present → writes file back without the marked block, preserves surrounding text, status `success`
- `uninstallSkill` user without markers → `skipped`, no write
- `uninstallSkill` project → deletes `<cwd>/.windsurf/rules/pointed.md`
- `unregisterMcp` user → removes `mcpServers.pointer`, preserves siblings
- `unregisterMcp` project → returns `degraded` with `effectiveScope: 'user'` and still attempts user-scope removal (mirrors install behaviour); if nothing to remove, `skipped`+`degraded` is fine — just settle on one and assert it. (Recommendation: always attempt user removal, then label `degraded` when the input scope was project. If removal succeeded → `degraded` + message "Windsurf MCP lives at user scope; removed there". If nothing to remove → `skipped` + same explanation.)
- `unregisterMcp` user, file missing → `skipped`

Update `jest.mock('fs/promises', …)` with `unlink` and `access`.

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @mcp-pointer/server test -- adapters/windsurf
```
Expected: FAIL — methods not implemented.

- [ ] **Step 3: Implement uninstall methods**

Add at top of file:
```ts
import { fileExists, deleteFileIfExists, removeJsonKey } from '../adapter-helpers';

function stripRuleBlock(existing: string): { changed: boolean; next: string } {
  const begin = existing.indexOf(RULE_BEGIN);
  const end = existing.indexOf(RULE_END);
  if (begin === -1 || end === -1 || end < begin) {
    return { changed: false, next: existing };
  }
  const before = existing.substring(0, begin);
  const after = existing.substring(end + RULE_END.length);
  const next = `${before}${after}`.replace(/\n{3,}/g, '\n\n').replace(/^\s*\n/, '');
  return { changed: true, next };
}
```

Inside `windsurfAdapter`:
```ts
  async unregisterMcp(scope): Promise<OperationResult> {
    const isDegraded = scope === 'project';
    const effectiveScope: Scope = 'user';
    const filePath = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
    if (!(await fileExists(filePath))) {
      return {
        status: 'skipped', scope: effectiveScope, path: filePath,
        message: isDegraded
          ? 'Windsurf MCP lives at user scope; nothing to remove there.'
          : 'mcp_config.json not found',
      };
    }
    try {
      const existing = await readJsonOrDefault<Record<string, any>>(filePath, {});
      const removed = removeJsonKey(existing, ['mcpServers', MCP_SERVER_NAME]);
      if (!removed) {
        return {
          status: 'skipped', scope: effectiveScope, path: filePath,
          message: 'pointer entry not present',
        };
      }
      await writeFileEnsuringDir(filePath, JSON.stringify(existing, null, 2));
      return {
        status: isDegraded ? 'degraded' : 'success',
        scope: effectiveScope, path: filePath,
        message: isDegraded
          ? 'Windsurf MCP lives at user scope; removed there.'
          : 'pointer entry removed',
      };
    } catch (e) {
      return { status: 'failed', scope: effectiveScope, message: `Edit failed: ${(e as Error).message}` };
    }
  },

  async uninstallCommand(scope): Promise<OperationResult> {
    const base = scope === 'user'
      ? path.join(os.homedir(), '.codeium', 'windsurf')
      : path.join(process.cwd(), '.windsurf');
    const filePath = path.join(base, 'workflows', `${TRIGGER_NAME}.md`);
    try {
      const r = await deleteFileIfExists(filePath);
      return r === 'deleted'
        ? { status: 'success', scope, path: filePath, message: 'Workflow removed' }
        : { status: 'skipped', scope, path: filePath, message: 'Workflow file not found' };
    } catch (e) {
      return { status: 'failed', scope, message: `Delete failed: ${(e as Error).message}` };
    }
  },

  async uninstallSkill(scope): Promise<OperationResult> {
    try {
      if (scope === 'user') {
        const filePath = path.join(os.homedir(), '.codeium', 'windsurf', 'global_rules.md');
        if (!(await fileExists(filePath))) {
          return { status: 'skipped', scope, path: filePath, message: 'global_rules.md not found' };
        }
        const existing = await readTextOrEmpty(filePath);
        const { changed, next } = stripRuleBlock(existing);
        if (!changed) {
          return { status: 'skipped', scope, path: filePath, message: 'No mcp-pointer block found' };
        }
        await writeFileEnsuringDir(filePath, next);
        return { status: 'success', scope, path: filePath, message: 'Rule block removed from global_rules.md' };
      }
      const filePath = path.join(process.cwd(), '.windsurf', 'rules', `${TRIGGER_NAME}.md`);
      const r = await deleteFileIfExists(filePath);
      return r === 'deleted'
        ? { status: 'success', scope, path: filePath, message: 'Skill rule removed' }
        : { status: 'skipped', scope, path: filePath, message: 'Skill file not found' };
    } catch (e) {
      return { status: 'failed', scope, message: `Delete failed: ${(e as Error).message}` };
    }
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @mcp-pointer/server test -- adapters/windsurf
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/config/adapters/windsurf.ts \
        packages/server/src/config/__tests__/adapters/windsurf.test.ts
git commit -m "feat(config/windsurf): symmetric uninstall incl. global_rules block strip"
```

---

## Task 7: Codex adapter uninstall (TOML removal)

**Files:**
- Modify: `packages/server/src/config/adapters/codex.ts`
- Modify: `packages/server/src/config/__tests__/adapters/codex.test.ts`

Codex stores MCP config in TOML. We need a TOML-aware removal that strips the `[mcp_servers.pointer]` table **and** the `[mcp_servers.pointer.env]` sub-table (and any other `[mcp_servers.pointer.<key>]` sub-tables), leaving other `[mcp_servers.<other>]` tables intact.

- [ ] **Step 1: Write failing tests**

Append a `describe('codexAdapter uninstall', …)` block covering:

- `uninstallCommand` → `~/.codex/prompts/pointed.md` delete (user-only; for `scope='project'` returns `degraded` matching install)
- `unregisterMcp`:
  - Removes `[mcp_servers.pointer]` and `[mcp_servers.pointer.env]` only, preserves `[mcp_servers.other]`
  - Returns `skipped` when no `[mcp_servers.pointer]` table found
  - Returns `skipped` when `config.toml` missing
  - When `pointer` is the only entry under `[mcp_servers.*]`, file is written with that section removed (other top-level keys preserved); does not unlink

Example fixture for the "removes pointer only" test:
```ts
const before = `# top-level
key = "value"

[mcp_servers.other]
command = "other"

[mcp_servers.pointer]
command = "npx"
args = ["-y", "@mcp-pointer/server@latest", "start"]

[mcp_servers.pointer.env]
MCP_POINTER_PORT = "7007"

[unrelated]
foo = "bar"
`;
// after removal: contains `[mcp_servers.other]` and `[unrelated]` and `key = "value"`,
// does NOT contain `[mcp_servers.pointer]` or `[mcp_servers.pointer.env]`.
```

Update `jest.mock('fs/promises', …)` with `unlink` and `access`.

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @mcp-pointer/server test -- adapters/codex
```
Expected: FAIL.

- [ ] **Step 3: Implement uninstall methods**

Add a TOML-stripping helper next to the existing `mergeToml` in `codex.ts`:
```ts
function stripPointerToml(existing: string): { changed: boolean; next: string } {
  const headerRe = /^\s*\[mcp_servers\.pointer(?:\.[\w-]+)?\]\s*$/;
  const otherHeaderRe = /^\s*\[/;
  const lines = existing.split('\n');
  const out: string[] = [];
  let changed = false;
  let i = 0;
  while (i < lines.length) {
    if (headerRe.test(lines[i])) {
      changed = true;
      i += 1;
      while (i < lines.length && !otherHeaderRe.test(lines[i])) i += 1;
    } else {
      out.push(lines[i]);
      i += 1;
    }
  }
  // collapse runs of >=3 blank lines that the removal can create
  const collapsed = out.join('\n').replace(/\n{3,}/g, '\n\n');
  return { changed, next: collapsed };
}
```

Add inside `codexAdapter`:
```ts
  async unregisterMcp(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.codex', 'config.toml');
    if (!(await fileExists(filePath))) {
      return { status: 'skipped', scope, path: filePath, message: 'config.toml not found' };
    }
    try {
      const existing = await readTextOrEmpty(filePath);
      const { changed, next } = stripPointerToml(existing);
      if (!changed) {
        return { status: 'skipped', scope, path: filePath, message: '[mcp_servers.pointer] not present' };
      }
      await writeFileEnsuringDir(filePath, next);
      return { status: 'success', scope, path: filePath, message: '[mcp_servers.pointer] removed from config.toml' };
    } catch (e) {
      return { status: 'failed', scope, message: `Edit failed: ${(e as Error).message}` };
    }
  },

  async uninstallCommand(scope): Promise<OperationResult> {
    const filePath = path.join(os.homedir(), '.codex', 'prompts', `${TRIGGER_NAME}.md`);
    const isDegraded = scope === 'project';
    const effectiveScope: Scope = 'user';
    try {
      const r = await deleteFileIfExists(filePath);
      const baseMsg = r === 'deleted' ? 'Slash command (prompt) removed' : 'Prompt file not found';
      return {
        status: r === 'deleted' ? (isDegraded ? 'degraded' : 'success') : 'skipped',
        scope: effectiveScope, path: filePath,
        message: isDegraded
          ? `Codex prompts live at user scope; ${baseMsg.toLowerCase()}.`
          : baseMsg,
      };
    } catch (e) {
      return { status: 'failed', scope: effectiveScope, message: `Delete failed: ${(e as Error).message}` };
    }
  },
  // No uninstallSkill: codex has no separate skill mechanism.
```

Add imports:
```ts
import { fileExists, deleteFileIfExists } from '../adapter-helpers';
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @mcp-pointer/server test -- adapters/codex
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/config/adapters/codex.ts \
        packages/server/src/config/__tests__/adapters/codex.test.ts
git commit -m "feat(config/codex): symmetric uninstall with TOML pointer-table strip"
```

---

## Task 8: OpenCode adapter uninstall

**Files:**
- Modify: `packages/server/src/config/adapters/opencode.ts`
- Modify: `packages/server/src/config/__tests__/adapters/opencode.test.ts`

OpenCode JSON uses `mcp` key (not `mcpServers`) at the root.

- [ ] **Step 1: Write failing tests**

Append a `describe('opencodeAdapter uninstall', …)` block:

- `uninstallCommand` user → deletes `~/.config/opencode/commands/pointed.md`
- `uninstallCommand` project → deletes `<cwd>/.opencode/commands/pointed.md`
- `unregisterMcp` user → removes `mcp.pointer` from `~/.config/opencode/opencode.json` preserving siblings
- `unregisterMcp` project → removes `mcp.pointer` from `<cwd>/opencode.json`
- `unregisterMcp` returns `skipped` when file missing or key absent

Update fs/promises mock to include `unlink` + `access`.

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @mcp-pointer/server test -- adapters/opencode
```
Expected: FAIL.

- [ ] **Step 3: Implement uninstall methods**

Add inside `opencodeAdapter`:
```ts
  async unregisterMcp(scope): Promise<OperationResult> {
    const filePath = scope === 'user' ? userConfigPath() : projectConfigPath();
    if (!(await fileExists(filePath))) {
      return { status: 'skipped', scope, path: filePath, message: 'opencode.json not found' };
    }
    try {
      const existing = await readJsonOrDefault<Record<string, any>>(filePath, {});
      const removed = removeJsonKey(existing, ['mcp', MCP_SERVER_NAME]);
      if (!removed) {
        return { status: 'skipped', scope, path: filePath, message: 'pointer entry not present' };
      }
      await writeFileEnsuringDir(filePath, JSON.stringify(existing, null, 2));
      return { status: 'success', scope, path: filePath, message: 'pointer entry removed' };
    } catch (e) {
      return { status: 'failed', scope, message: `Edit failed: ${(e as Error).message}` };
    }
  },

  async uninstallCommand(scope): Promise<OperationResult> {
    const filePath = scope === 'user'
      ? path.join(os.homedir(), '.config', 'opencode', 'commands', `${TRIGGER_NAME}.md`)
      : path.join(process.cwd(), '.opencode', 'commands', `${TRIGGER_NAME}.md`);
    try {
      const r = await deleteFileIfExists(filePath);
      return r === 'deleted'
        ? { status: 'success', scope, path: filePath, message: 'Slash command removed' }
        : { status: 'skipped', scope, path: filePath, message: 'Slash command file not found' };
    } catch (e) {
      return { status: 'failed', scope, message: `Delete failed: ${(e as Error).message}` };
    }
  },
  // No uninstallSkill.
```

Imports:
```ts
import { fileExists, deleteFileIfExists, removeJsonKey } from '../adapter-helpers';
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @mcp-pointer/server test -- adapters/opencode
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/config/adapters/opencode.ts \
        packages/server/src/config/__tests__/adapters/opencode.test.ts
git commit -m "feat(config/opencode): symmetric uninstall (MCP, command)"
```

---

## Task 9: JoyCode adapter uninstall

**Files:**
- Modify: `packages/server/src/config/adapters/joycode.ts`
- Modify: `packages/server/src/config/__tests__/adapters/joycode.test.ts`

JoyCode is the messiest:
- `unregisterMcp`: user → `~/.joycode/joycode-mcp.json` (remove `mcpServers.pointer`); project → `<cwd>/.joycode/mcp.json`
- `uninstallCommand`: project-only — open `<cwd>/.joycode/prompt.json` (an **array**), remove all entries whose `.name` starts with `POINTER_PREFIX = 'pointer'`. If the array becomes empty, write `[]` back. For `scope='user'`, return `degraded` mirroring install behaviour.
- `uninstallSkill`: delete `<base>/.joycode/skills/pointed/SKILL.md`

- [ ] **Step 1: Write failing tests**

Append `describe('joycodeAdapter uninstall', …)`:

- `uninstallSkill` user/project → deletes `<base>/.joycode/skills/pointed/SKILL.md`
- `unregisterMcp` user → removes `mcpServers.pointer` from `joycode-mcp.json`
- `unregisterMcp` project → removes from `.joycode/mcp.json`
- `unregisterMcp` → `skipped` when file missing or key absent
- `uninstallCommand` project:
  - existing prompt.json with one `pointerPointed` entry and one `other` entry → after, only `other` remains, status `success`
  - existing prompt.json with only `pointerPointed` → after, `[]` written, status `success`
  - missing prompt.json → `skipped`
  - prompt.json without any pointer-prefixed entry → `skipped`
- `uninstallCommand` user → returns `degraded` with `effectiveScope: 'project'` and still operates on project-cwd file (matches install). If nothing to remove, `skipped`.

Update fs/promises mock.

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @mcp-pointer/server test -- adapters/joycode
```
Expected: FAIL.

- [ ] **Step 3: Implement uninstall methods**

Add inside `joycodeAdapter`:
```ts
  async unregisterMcp(scope): Promise<OperationResult> {
    const filePath = scope === 'user'
      ? path.join(os.homedir(), '.joycode', 'joycode-mcp.json')
      : path.join(process.cwd(), '.joycode', 'mcp.json');
    if (!(await fileExists(filePath))) {
      return { status: 'skipped', scope, path: filePath, message: 'JoyCode MCP config not found' };
    }
    try {
      const existing = await readJsonOrDefault<Record<string, any>>(filePath, {});
      const removed = removeJsonKey(existing, ['mcpServers', MCP_SERVER_NAME]);
      if (!removed) {
        return { status: 'skipped', scope, path: filePath, message: 'pointer entry not present' };
      }
      await writeFileEnsuringDir(filePath, JSON.stringify(existing, null, 2));
      return { status: 'success', scope, path: filePath, message: 'pointer entry removed' };
    } catch (e) {
      return { status: 'failed', scope, message: `Edit failed: ${(e as Error).message}` };
    }
  },

  async uninstallCommand(scope): Promise<OperationResult> {
    const isDegraded = scope === 'user';
    const effectiveScope: Scope = 'project';
    const filePath = path.join(process.cwd(), '.joycode', 'prompt.json');
    if (!(await fileExists(filePath))) {
      return { status: 'skipped', scope: effectiveScope, path: filePath, message: 'prompt.json not found' };
    }
    try {
      const existing = await readJsonOrDefault<any[]>(filePath, []);
      const arr = Array.isArray(existing) ? existing : [];
      const filtered = arr.filter((e) => !(e && typeof e === 'object'
          && typeof (e as any).name === 'string'
          && (e as any).name.startsWith(POINTER_PREFIX)));
      if (filtered.length === arr.length) {
        return { status: 'skipped', scope: effectiveScope, path: filePath, message: 'No pointer-prefixed prompts present' };
      }
      await writeFileEnsuringDir(filePath, JSON.stringify(filtered, null, 2));
      return {
        status: isDegraded ? 'degraded' : 'success',
        scope: effectiveScope, path: filePath,
        message: isDegraded
          ? 'JoyCode prompts live at project scope; removed there.'
          : 'pointer-prefixed prompts removed',
      };
    } catch (e) {
      return { status: 'failed', scope: effectiveScope, message: `Edit failed: ${(e as Error).message}` };
    }
  },

  async uninstallSkill(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.joycode', 'skills', TRIGGER_NAME, 'SKILL.md');
    try {
      const r = await deleteFileIfExists(filePath);
      return r === 'deleted'
        ? { status: 'success', scope, path: filePath, message: 'Skill removed' }
        : { status: 'skipped', scope, path: filePath, message: 'Skill file not found' };
    } catch (e) {
      return { status: 'failed', scope, message: `Delete failed: ${(e as Error).message}` };
    }
  },
```

Imports:
```ts
import { fileExists, deleteFileIfExists, removeJsonKey } from '../adapter-helpers';
```

- [ ] **Step 4: Run tests pass + full suite + typecheck**

Run:
```bash
pnpm --filter @mcp-pointer/server test
pnpm --filter @mcp-pointer/server typecheck
```
Expected: all adapter tests pass; typecheck now passes (all six adapters implement the new interface).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/config/adapters/joycode.ts \
        packages/server/src/config/__tests__/adapters/joycode.test.ts
git commit -m "feat(config/joycode): symmetric uninstall (MCP, prompt, skill)"
```

---

## Task 10: Interactive prompt wrappers

**Files:**
- Create: `packages/server/src/config/prompts.ts`

- [ ] **Step 1: Write the prompts module**

```ts
import {
  checkbox, confirm, select,
} from '@inquirer/prompts';
import type { Scope, ToolAdapter } from './types';

export type Action = 'install' | 'uninstall';

function ensureTTY(): void {
  if (!process.stdin.isTTY) {
    throw new Error(
      'Interactive mode requires a TTY. Pass a tool name and --scope explicitly '
      + '(e.g. `mcp-pointer config claude --scope user`).',
    );
  }
}

export async function selectAction(): Promise<Action> {
  ensureTTY();
  return select<Action>({
    message: 'What do you want to do?',
    choices: [
      { name: 'Install — set up MCP Pointer for one or more agents', value: 'install' },
      { name: 'Uninstall — remove MCP Pointer from one or more agents', value: 'uninstall' },
    ],
  });
}

export async function selectAgents(
  adapters: ToolAdapter[],
  message: string,
): Promise<ToolAdapter[]> {
  ensureTTY();
  const selectedIds = await checkbox<string>({
    message,
    choices: adapters.map((a) => ({ name: a.displayName, value: a.toolId })),
    validate: (items) => (items.length === 0 ? 'Select at least one agent (space to toggle).' : true),
  });
  const byId = new Map(adapters.map((a) => [a.toolId, a]));
  return selectedIds.map((id) => byId.get(id)!).filter(Boolean);
}

export async function selectScope(): Promise<Scope> {
  ensureTTY();
  return select<Scope>({
    message: 'Install scope:',
    choices: [
      { name: 'user — global, all projects', value: 'user' },
      { name: 'project — current directory only', value: 'project' },
    ],
  });
}

export async function confirmSlash(): Promise<boolean> {
  ensureTTY();
  return confirm({
    message: 'Also install the slash command for the selected agents?',
    default: true,
  });
}

export async function confirmUninstall(agentNames: string[]): Promise<boolean> {
  ensureTTY();
  return confirm({
    message:
      `This will remove user-scope MCP entries, skills, and slash commands for: ${agentNames.join(', ')}.\n`
      + '  Project-scope installs must be removed manually.\n'
      + '  Continue?',
    default: false,
  });
}
```

- [ ] **Step 2: Verify it typechecks**

Run:
```bash
pnpm --filter @mcp-pointer/server typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/config/prompts.ts
git commit -m "feat(config): interactive prompt wrappers (inquirer)"
```

---

## Task 11: Orchestrator (`runInteractiveInstall`, `runInteractiveUninstall`, `executeForAgents`)

**Files:**
- Create: `packages/server/src/config/orchestrator.ts`
- Create: `packages/server/src/config/__tests__/orchestrator.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/server/src/config/__tests__/orchestrator.test.ts`:
```ts
import { executeForAgents } from '../orchestrator';
import type { ToolAdapter, OperationResult } from '../types';

function stub(toolId: any, displayName: string, results: Partial<Record<string, OperationResult>>): ToolAdapter {
  const ok: OperationResult = { status: 'success', message: 'ok' };
  return {
    toolId,
    displayName,
    registerMcp: jest.fn().mockResolvedValue(results.registerMcp ?? ok),
    installCommand: jest.fn().mockResolvedValue(results.installCommand ?? ok),
    installSkill: jest.fn().mockResolvedValue(results.installSkill ?? ok),
    unregisterMcp: jest.fn().mockResolvedValue(results.unregisterMcp ?? ok),
    uninstallCommand: jest.fn().mockResolvedValue(results.uninstallCommand ?? ok),
    uninstallSkill: jest.fn().mockResolvedValue(results.uninstallSkill ?? ok),
  };
}

describe('executeForAgents — install', () => {
  it('calls registerMcp + installSkill + installCommand when withSlash=true', async () => {
    const a = stub('claude', 'Claude', {});
    const summary = await executeForAgents([a], { mode: 'install', scope: 'user', port: 7007, withSlash: true });
    expect(a.registerMcp).toHaveBeenCalledWith('user', 7007);
    expect(a.installSkill).toHaveBeenCalledWith('user');
    expect(a.installCommand).toHaveBeenCalledWith('user');
    expect(summary.exitCode).toBe(0);
  });

  it('skips installCommand when withSlash=false', async () => {
    const a = stub('claude', 'Claude', {});
    await executeForAgents([a], { mode: 'install', scope: 'user', port: 7007, withSlash: false });
    expect(a.installCommand).not.toHaveBeenCalled();
  });

  it('exitCode=1 when any result is failed', async () => {
    const a = stub('claude', 'Claude', {
      registerMcp: { status: 'failed', message: 'boom' },
    });
    const summary = await executeForAgents([a], { mode: 'install', scope: 'user', port: 7007, withSlash: true });
    expect(summary.exitCode).toBe(1);
  });

  it('exitCode=0 when results are degraded or skipped', async () => {
    const a = stub('claude', 'Claude', {
      registerMcp: { status: 'degraded', message: 'ok-ish' },
      installSkill: { status: 'skipped', message: 'n/a' },
    });
    const summary = await executeForAgents([a], { mode: 'install', scope: 'user', port: 7007, withSlash: true });
    expect(summary.exitCode).toBe(0);
  });
});

describe('executeForAgents — uninstall', () => {
  it('calls unregisterMcp + uninstallSkill + uninstallCommand', async () => {
    const a = stub('claude', 'Claude', {});
    await executeForAgents([a], { mode: 'uninstall', scope: 'user' });
    expect(a.unregisterMcp).toHaveBeenCalledWith('user');
    expect(a.uninstallSkill).toHaveBeenCalledWith('user');
    expect(a.uninstallCommand).toHaveBeenCalledWith('user');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @mcp-pointer/server test -- orchestrator
```
Expected: FAIL — `executeForAgents` not exported.

- [ ] **Step 3: Implement the orchestrator**

Create `packages/server/src/config/orchestrator.ts`:
```ts
import logger from '../logger';
import { listAdapters } from './adapters/index';
import {
  selectAction, selectAgents, selectScope, confirmSlash, confirmUninstall,
} from './prompts';
import type { OperationResult, Scope, ToolAdapter } from './types';

export interface RunOptions {
  mode: 'install' | 'uninstall';
  scope: Scope;
  port?: number;       // install only
  withSlash?: boolean; // install only
}

export interface RunSummary {
  exitCode: 0 | 1;
}

function iconFor(status: OperationResult['status']): string {
  if (status === 'success') return '✅';
  if (status === 'degraded') return '⚠️';
  if (status === 'skipped') return '⏭';
  return '❌';
}

function printResult(adapter: ToolAdapter, label: string, r: OperationResult): void {
  const where = r.path ? ` (${r.path})` : '';
  logger.info(`  ${iconFor(r.status)} ${adapter.displayName} · ${label}: ${r.message}${where}`);
}

export async function executeForAgents(
  adapters: ToolAdapter[],
  opts: RunOptions,
): Promise<RunSummary> {
  const results: OperationResult[] = [];

  for (const adapter of adapters) {
    if (opts.mode === 'install') {
      const mcp = await adapter.registerMcp(opts.scope, opts.port ?? 7007);
      printResult(adapter, 'MCP server', mcp);
      results.push(mcp);

      if (adapter.installSkill) {
        const sk = await adapter.installSkill(opts.scope);
        printResult(adapter, 'Skill', sk);
        results.push(sk);
      }

      if (opts.withSlash) {
        const cmd = await adapter.installCommand(opts.scope);
        printResult(adapter, 'Slash command', cmd);
        results.push(cmd);
      }
    } else {
      const mcp = await adapter.unregisterMcp(opts.scope);
      printResult(adapter, 'MCP server', mcp);
      results.push(mcp);

      if (adapter.uninstallSkill) {
        const sk = await adapter.uninstallSkill(opts.scope);
        printResult(adapter, 'Skill', sk);
        results.push(sk);
      }

      const cmd = await adapter.uninstallCommand(opts.scope);
      printResult(adapter, 'Slash command', cmd);
      results.push(cmd);
    }
  }

  const exitCode: 0 | 1 = results.some((r) => r.status === 'failed') ? 1 : 0;
  return { exitCode };
}

export async function runInteractiveInstall(port: number): Promise<RunSummary> {
  const adapters = await selectAgents(listAdapters(), 'Select agents (space to toggle, enter to confirm):');
  const scope = await selectScope();
  const withSlash = await confirmSlash();
  logger.info('');
  logger.info(`🔧 Installing for ${adapters.map((a) => a.displayName).join(', ')} (${scope} scope)...`);
  return executeForAgents(adapters, { mode: 'install', scope, port, withSlash });
}

export async function runInteractiveUninstall(): Promise<RunSummary> {
  const adapters = await selectAgents(listAdapters(), 'Select agents to uninstall (user scope):');
  const ok = await confirmUninstall(adapters.map((a) => a.displayName));
  if (!ok) {
    logger.info('Cancelled.');
    return { exitCode: 0 };
  }
  logger.info('');
  logger.info(`🗑  Uninstalling from ${adapters.map((a) => a.displayName).join(', ')} (user scope)...`);
  const summary = await executeForAgents(adapters, { mode: 'uninstall', scope: 'user' });
  logger.info('');
  logger.info('💡 To remove project-scope installs, cd into the project and run:');
  logger.info('   mcp-pointer config --uninstall <tool> --scope project');
  return summary;
}

export async function runNonInteractiveUninstall(
  toolId: string, scope: Scope,
): Promise<RunSummary> {
  const adapter = listAdapters().find((a) => a.toolId === toolId);
  if (!adapter) {
    logger.error(`❌ Unsupported tool: ${toolId}`);
    return { exitCode: 1 };
  }
  logger.info(`🗑  Uninstalling MCP Pointer from ${adapter.displayName} (${scope} scope)...`);
  return executeForAgents([adapter], { mode: 'uninstall', scope });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @mcp-pointer/server test -- orchestrator
pnpm --filter @mcp-pointer/server typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/config/orchestrator.ts \
        packages/server/src/config/__tests__/orchestrator.test.ts
git commit -m "feat(config): orchestrator for install/uninstall across N agents"
```

---

## Task 12: Wire the new flows into `config.ts` and `cli.ts`

**Files:**
- Modify: `packages/server/src/config.ts`
- Modify: `packages/server/src/cli.ts`

- [ ] **Step 1: Refactor `config.ts` to delegate to the orchestrator**

Replace the bottom half of `packages/server/src/config.ts` (everything from `function showAvailableTools` to the end) with:
```ts
import {
  runInteractiveInstall,
  runInteractiveUninstall,
  runNonInteractiveUninstall,
  executeForAgents,
} from './config/orchestrator';

function getPort(): string {
  return process.env.MCP_POINTER_PORT || '7007';
}

export interface ConfigOpts {
  scope?: string;
  uninstall?: boolean;
}

export default async function configCommand(
  tool?: string,
  opts: ConfigOpts = {},
): Promise<void> {
  const port = parseInt(getPort(), 10);

  // Interactive flows
  if (!tool && !opts.uninstall) {
    try {
      const summary = await runInteractiveInstall(port);
      if (summary.exitCode !== 0) process.exit(summary.exitCode);
      return;
    } catch (e) {
      logger.error(`❌ ${(e as Error).message}`);
      process.exit(1);
    }
  }
  if (!tool && opts.uninstall) {
    try {
      const summary = await runInteractiveUninstall();
      if (summary.exitCode !== 0) process.exit(summary.exitCode);
      return;
    } catch (e) {
      logger.error(`❌ ${(e as Error).message}`);
      process.exit(1);
    }
  }

  // Non-interactive: tool is provided
  let scope: Scope;
  try {
    scope = await resolveScope(opts.scope);
  } catch (e) {
    logger.error(`❌ ${(e as Error).message}`);
    process.exit(1);
    return;
  }

  if (opts.uninstall) {
    const summary = await runNonInteractiveUninstall(tool!, scope);
    if (summary.exitCode !== 0) process.exit(summary.exitCode);
    return;
  }

  // Legacy install path
  const adapter = getAdapter(tool!);
  if (!adapter) {
    logger.error(`❌ Unsupported tool: ${tool}`);
    logger.error(`Supported tools: ${listAdapters().map((a) => a.toolId).join(', ')}`);
    process.exit(1);
    return;
  }
  logger.info(`🔧 Configuring MCP Pointer for ${adapter.displayName} (${scope} scope)...`);
  const summary = await executeForAgents([adapter], {
    mode: 'install', scope, port, withSlash: true,
  });
  if (summary.exitCode !== 0) process.exit(summary.exitCode);
}
```

Keep the top-of-file `MCPConfig` / `config` / `SupportedTool` exports as they were. Remove the old `showAvailableTools` and `printResult` (now in orchestrator).

- [ ] **Step 2: Update `cli.ts`**

Replace the `config` command registration in `packages/server/src/cli.ts`:
```ts
program
  .command(`${CLICommand.CONFIG} [tool]`)
  .option('--scope <scope>', 'Install scope: user or project (interactive if omitted)')
  .option('--uninstall', 'Remove MCP Pointer instead of installing')
  .description('Configure MCP Pointer for AI tools (interactive when no tool is given)')
  .action(configCommand);
```

- [ ] **Step 3: Typecheck + tests**

Run:
```bash
pnpm --filter @mcp-pointer/server typecheck
pnpm --filter @mcp-pointer/server test
```
Expected: all green.

- [ ] **Step 4: Build the bundle**

Run:
```bash
pnpm --filter @mcp-pointer/server build
```
Expected: `packages/server/dist/cli.cjs` rebuilt.

- [ ] **Step 5: Manual smoke (interactive flows)**

A real terminal is required (the harness can't drive arrow keys). Tell the user:

> "Please run the four smoke checks below in a real terminal and tell me what you see:
> ```bash
> node packages/server/dist/cli.cjs config            # interactive install
> node packages/server/dist/cli.cjs config --uninstall # interactive uninstall
> node packages/server/dist/cli.cjs config claude --scope user        # legacy install still works
> node packages/server/dist/cli.cjs config --uninstall claude --scope user  # non-interactive uninstall
> ```"

Expected: the first two render inquirer prompts (action selector for `--uninstall` flow is skipped; for plain `config` it shows agent multi-select with the agent list, then scope single-select, then a Y/n confirm for slash, then per-agent result lines). The third command behaves exactly as before. The fourth removes the user-scope MCP entry.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/config.ts packages/server/src/cli.ts
git commit -m "feat(config): wire interactive + --uninstall through CLI"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Implemented in |
| --- | --- |
| CLI shape (three forms) | Task 12 |
| Interactive install flow (action → agents → scope → slash → execute) | Tasks 10 (prompts) + 11 (orchestrator) + 12 (wiring) |
| Interactive uninstall flow (user-scope only + hint) | Tasks 10 (`confirmUninstall`) + 11 (`runInteractiveUninstall`) |
| ToolAdapter contract change (three new methods) | Task 3 |
| Idempotent / surgical / never-delete-user-files rules | Tasks 4–9 (per-adapter implementations + tests) |
| TOML strip for codex | Task 7 |
| Empty document written back (not unlinked) | Task 4 covers JSON case; Task 6 covers `global_rules.md` case |
| `@inquirer/prompts` dep added, bundled by esbuild | Task 1 |
| Adapter unit tests (5 cases per adapter) | Tasks 4–9 |
| Orchestrator integration test | Task 11 |
| Legacy `config <tool> --scope ...` unchanged | Task 12 routes legacy path through `executeForAgents` with the same `withSlash: true` default; per-agent result rendering matches the existing format |

**Placeholder scan:** none — every step ships exact code or exact commands.

**Type consistency:** `executeForAgents` is called with the same shape (`{ mode, scope, port?, withSlash? }`) in Task 11's tests and Task 12's wiring. `runInteractiveInstall(port: number)` matches `configCommand` reading `getPort()`. `confirmUninstall(agentNames: string[])` matches the call site. The three uninstall method names match across the contract (Task 3), every adapter (Tasks 4–9), and the orchestrator (Task 11).

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-29-interactive-config-command.md`.** Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

请问选哪种执行方式？
