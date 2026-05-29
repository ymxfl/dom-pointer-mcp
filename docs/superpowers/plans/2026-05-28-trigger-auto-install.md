# Trigger Auto-install 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 把 `dom-pointer-mcp config <tool>` 扩展为统一的 adapter 框架，同时安装 MCP 注册 + trigger 文件（skill/command/rule），支持 6 个 agent + scope 选择。

**Architecture:** 每个 tool 一个 adapter（实现 `registerMcp` + `installTrigger`），CLI 加 `--scope user|project` 参数 + TTY-fallback 交互。Adapter 内部自行处理 scope 降级。

**Tech Stack:** TypeScript + Node fs/promises / readline / child_process（无新依赖）+ jest 测试。

参考 spec: `docs/superpowers/specs/2026-05-28-trigger-auto-install-design.md`

---

## 文件结构

**新增**：
```
packages/server/src/config/
├── types.ts                        # 接口
├── scope.ts                        # resolveScope
├── trigger-content.ts              # 单一来源文案
├── adapter-helpers.ts              # writeFileEnsuringDir 等共用工具
├── adapters/
│   ├── index.ts                    # getAdapter
│   ├── claude.ts
│   ├── cursor.ts
│   ├── windsurf.ts
│   ├── codex.ts
│   ├── opencode.ts
│   └── joycode.ts
└── __tests__/
    ├── scope.test.ts               # 4 例
    ├── trigger-content.test.ts     # 1 例
    └── adapters/
        ├── claude.test.ts          # 4 例
        ├── cursor.test.ts          # 3 例
        ├── windsurf.test.ts        # 4 例
        ├── codex.test.ts           # 4 例
        ├── opencode.test.ts        # 3 例
        └── joycode.test.ts         # 4 例
```

**修改**：
- `packages/server/src/config.ts` — 瘦身为 `configCommand(tool, opts)` 入口 + `SupportedTool` enum + `showAvailableTools`，删除所有 `configureXxx`
- `packages/server/src/cli.ts` — `config` 命令加 `--scope` option
- `README.md` — 文档更新

---

## Task 1: 类型 + 共用工具

**Files:**
- Create: `packages/server/src/config/types.ts`
- Create: `packages/server/src/config/adapter-helpers.ts`

- [ ] **Step 1: 写 types.ts**

```ts
// packages/server/src/config/types.ts
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
  registerMcp(scope: Scope, port: number): Promise<OperationResult>;
  installTrigger(scope: Scope): Promise<OperationResult>;
}
```

- [ ] **Step 2: 写 adapter-helpers.ts**

```ts
// packages/server/src/config/adapter-helpers.ts
import path from 'path';
import fs from 'fs/promises';

export async function writeFileEnsuringDir(
  filePath: string,
  content: string,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

export async function readJsonOrDefault<T>(
  filePath: string,
  fallback: T,
): Promise<T> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export async function readTextOrEmpty(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add packages/server/src/config/types.ts packages/server/src/config/adapter-helpers.ts
git commit -m "feat(config): add adapter types and file helpers"
```

---

## Task 2: trigger-content + sanity 测试

**Files:**
- Create: `packages/server/src/config/trigger-content.ts`
- Create: `packages/server/src/config/__tests__/trigger-content.test.ts`

- [ ] **Step 1: 写 1 个 sanity 测试**

```ts
// packages/server/src/config/__tests__/trigger-content.test.ts
import {
  TRIGGER_NAME,
  TRIGGER_DESCRIPTION,
  TRIGGER_BODY,
} from '../trigger-content';

describe('trigger content sanity', () => {
  it('contains all required trigger phrases and concepts', () => {
    expect(TRIGGER_NAME).toBe('pointed');
    for (const phrase of [
      'pointed',
      'Option+Click',
      'mcp__pointer__get-pointed-element',
      'userNote',
    ]) {
      expect(TRIGGER_DESCRIPTION).toContain(phrase);
    }
    expect(TRIGGER_BODY).toContain('mcp__pointer__get-pointed-element');
    expect(TRIGGER_BODY).toContain('userNote');
    expect(TRIGGER_BODY).toContain('elements[]');
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `cd packages/server && pnpm test -- trigger-content`
Expected: failed (module not found)

- [ ] **Step 3: 写 trigger-content.ts**

```ts
// packages/server/src/config/trigger-content.ts
export const TRIGGER_NAME = 'pointed';

export const TRIGGER_DESCRIPTION =
  'When the user issues a short request about elements they have selected in the '
  + 'browser via Option+Click (e.g. "做一下", "pointed", "改一下选中的", "看看选中的"), '
  + 'IMMEDIATELY call mcp__pointer__get-pointed-element without first asking for '
  + 'clarification. The returned payload has userNote (the user\'s actual request) and '
  + 'elements[] (DOM info per element including selector, cssProperties, and componentInfo '
  + 'with source file). Treat userNote as the primary instruction and use elements[] to '
  + 'locate the source code.';

export const TRIGGER_BODY = `# Pointed elements trigger

When the user issues a short request like "做一下", "pointed", "改一下选中的", or any
brief instruction about what they have selected in their browser, you MUST:

1. Call the MCP tool \`mcp__pointer__get-pointed-element\` FIRST. Do not ask for
   clarification before calling — the tool returns the user's actual instructions.
2. Read \`userNote\` as the primary instruction.
3. Read \`elements[]\` for each selected DOM element:
   - \`selector\`: CSS selector
   - \`componentInfo.name\` + \`componentInfo.sourceFile\`: source file to edit
   - \`cssProperties\`: current computed styles
   - \`url\`: page where the element lives
4. Make the requested changes in source code. Reference elements by their array
   index (1-based) when the user uses \`[1]\`, \`[2]\` notation in their note.

If \`get-pointed-element\` returns "No selection pointed", inform the user to
Option+Click elements in the browser, write a note, and press Cmd/Ctrl+Enter
or Send before retrying.
`;
```

- [ ] **Step 4: 跑测试，确认 1 通过**

Run: `cd packages/server && pnpm test -- trigger-content`
Expected: 1 passed

- [ ] **Step 5: 提交**

```bash
git add packages/server/src/config/trigger-content.ts packages/server/src/config/__tests__/trigger-content.test.ts
git commit -m "feat(config): add single-source trigger content with sanity test"
```

---

## Task 3: scope.ts + 测试

**Files:**
- Create: `packages/server/src/config/__tests__/scope.test.ts`
- Create: `packages/server/src/config/scope.ts`

- [ ] **Step 1: 写 4 个失败测试**

```ts
// packages/server/src/config/__tests__/scope.test.ts
import { resolveScope } from '../scope';

describe('resolveScope', () => {
  const originalIsTTY = process.stdin.isTTY;
  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalIsTTY, configurable: true,
    });
  });

  it("returns 'user' when --scope=user", async () => {
    await expect(resolveScope('user')).resolves.toBe('user');
  });

  it("returns 'project' when --scope=project", async () => {
    await expect(resolveScope('project')).resolves.toBe('project');
  });

  it('throws on invalid scope value', async () => {
    await expect(resolveScope('foo')).rejects.toThrow(/Invalid --scope/);
  });

  it('throws when no scope and no TTY', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false, configurable: true,
    });
    await expect(resolveScope()).rejects.toThrow(/No --scope/);
  });
});
```

- [ ] **Step 2: 跑测试，确认 4 失败**

Run: `cd packages/server && pnpm test -- scope`
Expected: failed (module not found)

- [ ] **Step 3: 写实现**

```ts
// packages/server/src/config/scope.ts
import readline from 'readline';
import type { Scope } from './types';

export async function resolveScope(scopeArg?: string): Promise<Scope> {
  if (scopeArg) {
    if (scopeArg === 'user' || scopeArg === 'project') return scopeArg;
    throw new Error(`Invalid --scope: ${scopeArg}. Use 'user' or 'project'.`);
  }
  if (!process.stdin.isTTY) {
    throw new Error(
      'No --scope provided and no TTY for interactive prompt.\n'
      + 'Please pass --scope user or --scope project.',
    );
  }
  return promptScope();
}

function promptScope(): Promise<Scope> {
  const rl = readline.createInterface({
    input: process.stdin, output: process.stdout,
  });
  return new Promise((resolve, reject) => {
    rl.question(
      'Install scope:\n  1) user — global, all projects\n  2) project — current directory only\nChoice [1-2]: ',
      (answer) => {
        rl.close();
        const trimmed = answer.trim().toLowerCase();
        if (trimmed === '1' || trimmed === 'user') resolve('user');
        else if (trimmed === '2' || trimmed === 'project') resolve('project');
        else reject(new Error(`Invalid choice: ${answer}`));
      },
    );
  });
}
```

- [ ] **Step 4: 跑测试，确认 4 通过**

- [ ] **Step 5: 提交**

```bash
git add packages/server/src/config/scope.ts packages/server/src/config/__tests__/scope.test.ts
git commit -m "feat(config): add resolveScope with TTY fallback"
```

---

## Task 4: Claude adapter（TDD）

**Files:**
- Create: `packages/server/src/config/__tests__/adapters/claude.test.ts`
- Create: `packages/server/src/config/adapters/claude.ts`

- [ ] **Step 1: 写 4 个失败测试**

```ts
// packages/server/src/config/__tests__/adapters/claude.test.ts
import path from 'path';
import os from 'os';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

import fs from 'fs/promises';
import { execSync } from 'child_process';
import { claudeAdapter } from '../../adapters/claude';

const mockedWriteFile = fs.writeFile as jest.Mock;
const mockedExecSync = execSync as jest.Mock;

beforeEach(() => {
  mockedWriteFile.mockClear();
  mockedExecSync.mockClear();
  mockedExecSync.mockReturnValue('');
});

describe('claudeAdapter', () => {
  it('installTrigger user scope writes ~/.claude/skills/pointed/SKILL.md', async () => {
    const result = await claudeAdapter.installTrigger('user');
    expect(result.status).toBe('success');
    const expectedPath = path.join(os.homedir(), '.claude', 'skills', 'pointed', 'SKILL.md');
    expect(result.path).toBe(expectedPath);
    expect(mockedWriteFile).toHaveBeenCalledWith(expectedPath, expect.stringContaining('name: pointed'), 'utf8');
  });

  it('installTrigger project scope writes <cwd>/.claude/skills/pointed/SKILL.md', async () => {
    const result = await claudeAdapter.installTrigger('project');
    expect(result.status).toBe('success');
    const expectedPath = path.join(process.cwd(), '.claude', 'skills', 'pointed', 'SKILL.md');
    expect(result.path).toBe(expectedPath);
  });

  it('registerMcp project scope writes .mcp.json with pointer entry', async () => {
    const result = await claudeAdapter.registerMcp('project', 7007);
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(process.cwd(), '.mcp.json'));
    const writeCall = mockedWriteFile.mock.calls.find(
      (call) => call[0].endsWith('.mcp.json'),
    );
    expect(writeCall).toBeDefined();
    const written = JSON.parse(writeCall![1]);
    expect(written.mcpServers.pointer.command).toBe('npx');
    expect(written.mcpServers.pointer.env.MCP_POINTER_PORT).toBe('7007');
  });

  it('registerMcp user scope runs claude mcp add CLI', async () => {
    const result = await claudeAdapter.registerMcp('user', 7007);
    expect(result.status).toBe('success');
    const addCall = mockedExecSync.mock.calls.find(
      (call) => String(call[0]).includes('claude mcp add'),
    );
    expect(addCall).toBeDefined();
    expect(String(addCall![0])).toContain('MCP_POINTER_PORT=7007');
  });
});
```

- [ ] **Step 2: 跑测试，确认 4 失败**

Run: `cd packages/server && pnpm test -- claude.test`

- [ ] **Step 3: 写实现**

```ts
// packages/server/src/config/adapters/claude.ts
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import type { ToolAdapter, OperationResult } from '../types';
import { writeFileEnsuringDir } from '../adapter-helpers';
import { TRIGGER_NAME, TRIGGER_DESCRIPTION, TRIGGER_BODY } from '../trigger-content';

const MCP_SERVER_NAME = 'pointer';

function buildSkillFile(): string {
  return `---
name: ${TRIGGER_NAME}
description: ${JSON.stringify(TRIGGER_DESCRIPTION)}
---

${TRIGGER_BODY}`;
}

function buildProjectMcpJson(port: number): string {
  return JSON.stringify({
    mcpServers: {
      [MCP_SERVER_NAME]: {
        command: 'npx',
        args: ['-y', '@dom-pointer-mcp/server@latest', 'start'],
        env: { MCP_POINTER_PORT: String(port) },
      },
    },
  }, null, 2);
}

export const claudeAdapter: ToolAdapter = {
  toolId: 'claude',
  displayName: 'Claude Code',

  async registerMcp(scope, port): Promise<OperationResult> {
    if (scope === 'user') {
      try {
        try {
          execSync(`claude mcp remove ${MCP_SERVER_NAME} -s user`, { stdio: 'pipe' });
        } catch { /* ignore: not installed */ }
        execSync(
          `claude mcp add ${MCP_SERVER_NAME} -s user --env MCP_POINTER_PORT=${port} `
          + '-- npx -y @dom-pointer-mcp/server@latest start',
          { stdio: 'pipe' },
        );
        return {
          status: 'success', scope, path: 'claude mcp add -s user',
          message: 'MCP server registered (user scope)',
        };
      } catch (e) {
        return {
          status: 'failed', scope,
          message: `claude mcp add failed: ${(e as Error).message}. Is Claude Code CLI installed?`,
        };
      }
    }
    const filePath = path.join(process.cwd(), '.mcp.json');
    try {
      await writeFileEnsuringDir(filePath, buildProjectMcpJson(port));
      return {
        status: 'success', scope, path: filePath,
        message: 'MCP server registered at .mcp.json',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installTrigger(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.claude', 'skills', TRIGGER_NAME, 'SKILL.md');
    try {
      await writeFileEnsuringDir(filePath, buildSkillFile());
      return {
        status: 'success', scope, path: filePath,
        message: 'Trigger skill installed',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },
};
```

- [ ] **Step 4: 跑测试，确认 4 通过**

- [ ] **Step 5: 提交**

```bash
git add packages/server/src/config/adapters/claude.ts packages/server/src/config/__tests__/adapters/claude.test.ts
git commit -m "feat(config): add claude adapter with user/project MCP + trigger"
```

---

## Task 5: Cursor adapter（TDD）

**Files:**
- Create: `packages/server/src/config/__tests__/adapters/cursor.test.ts`
- Create: `packages/server/src/config/adapters/cursor.ts`

- [ ] **Step 1: 写 3 个失败测试**

```ts
// packages/server/src/config/__tests__/adapters/cursor.test.ts
import path from 'path';
import os from 'os';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
}));

import fs from 'fs/promises';
import { cursorAdapter } from '../../adapters/cursor';

const mockedWriteFile = fs.writeFile as jest.Mock;

beforeEach(() => { mockedWriteFile.mockClear(); });

describe('cursorAdapter', () => {
  it('installTrigger user scope writes ~/.cursor/rules/pointed.mdc', async () => {
    const result = await cursorAdapter.installTrigger('user');
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(os.homedir(), '.cursor', 'rules', 'pointed.mdc'));
    expect(mockedWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('pointed.mdc'),
      expect.stringContaining('description:'),
      'utf8',
    );
  });

  it('installTrigger project scope writes <cwd>/.cursor/rules/pointed.mdc', async () => {
    const result = await cursorAdapter.installTrigger('project');
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(process.cwd(), '.cursor', 'rules', 'pointed.mdc'));
  });

  it('registerMcp project scope writes .cursor/mcp.json with pointer entry', async () => {
    const result = await cursorAdapter.registerMcp('project', 7007);
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(process.cwd(), '.cursor', 'mcp.json'));
    const written = JSON.parse(mockedWriteFile.mock.calls[0][1]);
    expect(written.mcpServers.pointer.env.MCP_POINTER_PORT).toBe('7007');
  });
});
```

- [ ] **Step 2: 跑测试，确认 3 失败**

- [ ] **Step 3: 写实现**

```ts
// packages/server/src/config/adapters/cursor.ts
import path from 'path';
import os from 'os';
import type { ToolAdapter, OperationResult } from '../types';
import { writeFileEnsuringDir } from '../adapter-helpers';
import { TRIGGER_NAME, TRIGGER_DESCRIPTION, TRIGGER_BODY } from '../trigger-content';

const MCP_SERVER_NAME = 'pointer';

function buildMdcFile(): string {
  return `---
description: ${JSON.stringify(TRIGGER_DESCRIPTION)}
alwaysApply: false
---

${TRIGGER_BODY}`;
}

function buildMcpJson(port: number): string {
  return JSON.stringify({
    mcpServers: {
      [MCP_SERVER_NAME]: {
        command: 'npx',
        args: ['-y', '@dom-pointer-mcp/server@latest', 'start'],
        env: { MCP_POINTER_PORT: String(port) },
      },
    },
  }, null, 2);
}

export const cursorAdapter: ToolAdapter = {
  toolId: 'cursor',
  displayName: 'Cursor',

  async registerMcp(scope, port): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.cursor', 'mcp.json');
    try {
      await writeFileEnsuringDir(filePath, buildMcpJson(port));
      return {
        status: 'success', scope, path: filePath,
        message: `MCP server registered at ${path.relative(process.cwd(), filePath) || filePath}`,
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installTrigger(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.cursor', 'rules', `${TRIGGER_NAME}.mdc`);
    try {
      await writeFileEnsuringDir(filePath, buildMdcFile());
      return { status: 'success', scope, path: filePath, message: 'Trigger rule installed' };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },
};
```

- [ ] **Step 4: 跑测试 + 提交**

```bash
cd packages/server && pnpm test -- cursor.test
git add packages/server/src/config/adapters/cursor.ts packages/server/src/config/__tests__/adapters/cursor.test.ts
git commit -m "feat(config): add cursor adapter"
```

---

## Task 6: Windsurf adapter（TDD，含 project MCP degrade）

**Files:**
- Create: `packages/server/src/config/__tests__/adapters/windsurf.test.ts`
- Create: `packages/server/src/config/adapters/windsurf.ts`

- [ ] **Step 1: 写 4 个失败测试**

```ts
// packages/server/src/config/__tests__/adapters/windsurf.test.ts
import path from 'path';
import os from 'os';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
}));

import fs from 'fs/promises';
import { windsurfAdapter } from '../../adapters/windsurf';

const mockedWriteFile = fs.writeFile as jest.Mock;

beforeEach(() => { mockedWriteFile.mockClear(); });

describe('windsurfAdapter', () => {
  it('installTrigger user appends to ~/.codeium/windsurf/global_rules.md', async () => {
    const result = await windsurfAdapter.installTrigger('user');
    expect(result.status).toBe('success');
    expect(result.path).toBe(
      path.join(os.homedir(), '.codeium', 'windsurf', 'global_rules.md'),
    );
  });

  it('installTrigger project writes <cwd>/.windsurf/rules/pointed.md', async () => {
    const result = await windsurfAdapter.installTrigger('project');
    expect(result.status).toBe('success');
    expect(result.path).toBe(
      path.join(process.cwd(), '.windsurf', 'rules', 'pointed.md'),
    );
  });

  it('registerMcp user writes ~/.codeium/windsurf/mcp_config.json', async () => {
    const result = await windsurfAdapter.registerMcp('user', 7007);
    expect(result.status).toBe('success');
    expect(result.path).toBe(
      path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json'),
    );
  });

  it('registerMcp project degrades to user scope with warning', async () => {
    const result = await windsurfAdapter.registerMcp('project', 7007);
    expect(result.status).toBe('degraded');
    expect(result.scope).toBe('user');
    expect(result.message).toMatch(/does not support project-level/i);
  });
});
```

- [ ] **Step 2: 跑测试，4 失败**

- [ ] **Step 3: 写实现**

```ts
// packages/server/src/config/adapters/windsurf.ts
import path from 'path';
import os from 'os';
import type { ToolAdapter, OperationResult, Scope } from '../types';
import { writeFileEnsuringDir, readTextOrEmpty, readJsonOrDefault } from '../adapter-helpers';
import { TRIGGER_NAME, TRIGGER_DESCRIPTION, TRIGGER_BODY } from '../trigger-content';

const MCP_SERVER_NAME = 'pointer';
const RULE_BEGIN = '<!-- BEGIN dom-pointer-mcp trigger -->';
const RULE_END = '<!-- END dom-pointer-mcp trigger -->';

function buildRuleSection(): string {
  return `${RULE_BEGIN}
${TRIGGER_BODY}
${RULE_END}`;
}

function mergeGlobalRules(existing: string): string {
  const begin = existing.indexOf(RULE_BEGIN);
  if (begin === -1) {
    const trimmed = existing.trimEnd();
    const prefix = trimmed.length > 0 ? `${trimmed}\n\n` : '';
    return `${prefix}${buildRuleSection()}\n`;
  }
  const end = existing.indexOf(RULE_END);
  if (end === -1) {
    return `${existing.substring(0, begin)}${buildRuleSection()}\n`;
  }
  return `${existing.substring(0, begin)}${buildRuleSection()}${existing.substring(end + RULE_END.length)}`;
}

function buildMcpConfig(port: number, existingMcpServers: Record<string, unknown> = {}) {
  return {
    mcpServers: {
      ...existingMcpServers,
      [MCP_SERVER_NAME]: {
        command: 'npx',
        args: ['-y', '@dom-pointer-mcp/server@latest', 'start'],
        env: { MCP_POINTER_PORT: String(port) },
      },
    },
  };
}

export const windsurfAdapter: ToolAdapter = {
  toolId: 'windsurf',
  displayName: 'Windsurf',

  async registerMcp(scope, port): Promise<OperationResult> {
    const isDegraded = scope === 'project';
    const effectiveScope: Scope = 'user';
    const filePath = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
    try {
      const existing = await readJsonOrDefault<{ mcpServers?: Record<string, unknown> }>(
        filePath, {},
      );
      const merged = buildMcpConfig(port, existing.mcpServers ?? {});
      await writeFileEnsuringDir(filePath, JSON.stringify(merged, null, 2));
      return {
        status: isDegraded ? 'degraded' : 'success',
        scope: effectiveScope,
        path: filePath,
        message: isDegraded
          ? 'Windsurf does not support project-level MCP; installed at user scope instead.'
          : 'MCP server registered at user scope',
      };
    } catch (e) {
      return { status: 'failed', scope: effectiveScope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installTrigger(scope): Promise<OperationResult> {
    try {
      if (scope === 'user') {
        const filePath = path.join(os.homedir(), '.codeium', 'windsurf', 'global_rules.md');
        const existing = await readTextOrEmpty(filePath);
        await writeFileEnsuringDir(filePath, mergeGlobalRules(existing));
        return {
          status: 'success', scope, path: filePath,
          message: 'Trigger rule appended to global_rules.md',
        };
      }
      const filePath = path.join(process.cwd(), '.windsurf', 'rules', `${TRIGGER_NAME}.md`);
      const ruleFile = `---
description: ${JSON.stringify(TRIGGER_DESCRIPTION)}
---

${TRIGGER_BODY}`;
      await writeFileEnsuringDir(filePath, ruleFile);
      return { status: 'success', scope, path: filePath, message: 'Trigger rule installed' };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },
};
```

- [ ] **Step 4: 跑测试 + 提交**

```bash
cd packages/server && pnpm test -- windsurf.test
git add packages/server/src/config/adapters/windsurf.ts packages/server/src/config/__tests__/adapters/windsurf.test.ts
git commit -m "feat(config): add windsurf adapter with project-MCP degrade"
```

---

## Task 7: Codex adapter（TDD，含 TOML merge + trigger degrade）

**Files:**
- Create: `packages/server/src/config/__tests__/adapters/codex.test.ts`
- Create: `packages/server/src/config/adapters/codex.ts`

- [ ] **Step 1: 写 4 个失败测试**

```ts
// packages/server/src/config/__tests__/adapters/codex.test.ts
import path from 'path';
import os from 'os';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
}));

import fs from 'fs/promises';
import { codexAdapter } from '../../adapters/codex';

const mockedWriteFile = fs.writeFile as jest.Mock;
const mockedReadFile = fs.readFile as jest.Mock;

beforeEach(() => {
  mockedWriteFile.mockClear();
  mockedReadFile.mockClear();
  mockedReadFile.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
});

describe('codexAdapter', () => {
  it('installTrigger user writes ~/.codex/prompts/pointed.md', async () => {
    const result = await codexAdapter.installTrigger('user');
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(os.homedir(), '.codex', 'prompts', 'pointed.md'));
  });

  it('installTrigger project degrades to user scope', async () => {
    const result = await codexAdapter.installTrigger('project');
    expect(result.status).toBe('degraded');
    expect(result.scope).toBe('user');
    expect(result.message).toMatch(/only supports user-level/i);
  });

  it('registerMcp user writes ~/.codex/config.toml with [mcp_servers.pointer]', async () => {
    const result = await codexAdapter.registerMcp('user', 7007);
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(os.homedir(), '.codex', 'config.toml'));
    const content = mockedWriteFile.mock.calls[0][1] as string;
    expect(content).toMatch(/\[mcp_servers\.pointer\]/);
    expect(content).toContain('command = "npx"');
    expect(content).toContain('MCP_POINTER_PORT = "7007"');
  });

  it('registerMcp project preserves existing TOML content', async () => {
    mockedReadFile.mockResolvedValueOnce(
      '[other]\nfoo = "bar"\n\n[mcp_servers.previously]\ncommand = "old"\n',
    );
    const result = await codexAdapter.registerMcp('project', 7007);
    expect(result.status).toBe('success');
    const content = mockedWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('[other]');
    expect(content).toContain('foo = "bar"');
    expect(content).toContain('[mcp_servers.previously]');
    expect(content).toContain('[mcp_servers.pointer]');
  });
});
```

- [ ] **Step 2: 跑测试，4 失败**

- [ ] **Step 3: 写实现**

```ts
// packages/server/src/config/adapters/codex.ts
import path from 'path';
import os from 'os';
import type { ToolAdapter, OperationResult, Scope } from '../types';
import { writeFileEnsuringDir, readTextOrEmpty } from '../adapter-helpers';
import { TRIGGER_NAME, TRIGGER_DESCRIPTION, TRIGGER_BODY } from '../trigger-content';

const MCP_SERVER_NAME = 'pointer';

function buildTomlSection(port: number): string {
  return `[mcp_servers.${MCP_SERVER_NAME}]
command = "npx"
args = ["-y", "@dom-pointer-mcp/server@latest", "start"]

[mcp_servers.${MCP_SERVER_NAME}.env]
MCP_POINTER_PORT = "${port}"
`;
}

function mergeToml(existing: string, port: number): string {
  const section = buildTomlSection(port);
  // Replace any existing [mcp_servers.pointer] block + its [mcp_servers.pointer.env]
  // sub-block. We find the start of [mcp_servers.pointer] and the start of the next
  // [...] block that is NOT a sub-table of [mcp_servers.pointer.*].
  const headerRe = /^\[mcp_servers\.pointer(?:\.[\w-]+)?\]/m;
  if (!headerRe.test(existing)) {
    const trimmed = existing.trimEnd();
    const prefix = trimmed.length > 0 ? `${trimmed}\n\n` : '';
    return `${prefix}${section}`;
  }
  const lines = existing.split('\n');
  const result: string[] = [];
  let i = 0;
  let inserted = false;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\[mcp_servers\.pointer(?:\.[\w-]+)?\]/.test(line.trim())) {
      // skip this section + following sub-sections until next non-pointer header
      i += 1;
      while (i < lines.length) {
        const t = lines[i].trim();
        if (/^\[/.test(t) && !/^\[mcp_servers\.pointer(?:\.[\w-]+)?\]/.test(t)) break;
        i += 1;
      }
      if (!inserted) {
        result.push(...section.split('\n'));
        inserted = true;
      }
    } else {
      result.push(line);
      i += 1;
    }
  }
  return result.join('\n');
}

function buildPromptFile(): string {
  return `---
description: ${JSON.stringify(TRIGGER_DESCRIPTION)}
argument-hint: command arguments
---

${TRIGGER_BODY}`;
}

export const codexAdapter: ToolAdapter = {
  toolId: 'codex',
  displayName: 'Codex CLI',

  async registerMcp(scope, port): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.codex', 'config.toml');
    try {
      const existing = await readTextOrEmpty(filePath);
      const merged = mergeToml(existing, port);
      await writeFileEnsuringDir(filePath, merged);
      return {
        status: 'success', scope, path: filePath,
        message: 'MCP server section merged into config.toml',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installTrigger(scope): Promise<OperationResult> {
    const filePath = path.join(os.homedir(), '.codex', 'prompts', `${TRIGGER_NAME}.md`);
    const isDegraded = scope === 'project';
    const effectiveScope: Scope = 'user';
    try {
      await writeFileEnsuringDir(filePath, buildPromptFile());
      return {
        status: isDegraded ? 'degraded' : 'success',
        scope: effectiveScope,
        path: filePath,
        message: isDegraded
          ? 'Codex only supports user-level prompts; installed at user scope instead.'
          : 'Trigger prompt installed',
      };
    } catch (e) {
      return {
        status: 'failed', scope: effectiveScope,
        message: `Write failed: ${(e as Error).message}`,
      };
    }
  },
};
```

- [ ] **Step 4: 跑测试 + 提交**

```bash
cd packages/server && pnpm test -- codex.test
git add packages/server/src/config/adapters/codex.ts packages/server/src/config/__tests__/adapters/codex.test.ts
git commit -m "feat(config): add codex adapter with TOML merge + project-trigger degrade"
```

---

## Task 8: Opencode adapter（TDD）

**Files:**
- Create: `packages/server/src/config/__tests__/adapters/opencode.test.ts`
- Create: `packages/server/src/config/adapters/opencode.ts`

- [ ] **Step 1: 写 3 个失败测试**

```ts
// packages/server/src/config/__tests__/adapters/opencode.test.ts
import path from 'path';
import os from 'os';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
}));

import fs from 'fs/promises';
import { opencodeAdapter } from '../../adapters/opencode';

const mockedWriteFile = fs.writeFile as jest.Mock;
const mockedReadFile = fs.readFile as jest.Mock;

beforeEach(() => {
  mockedWriteFile.mockClear();
  mockedReadFile.mockClear();
  mockedReadFile.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
});

describe('opencodeAdapter', () => {
  it('installTrigger user writes ~/.config/opencode/commands/pointed.md', async () => {
    const result = await opencodeAdapter.installTrigger('user');
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(os.homedir(), '.config', 'opencode', 'commands', 'pointed.md'));
  });

  it('installTrigger project writes <cwd>/.opencode/commands/pointed.md', async () => {
    const result = await opencodeAdapter.installTrigger('project');
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(process.cwd(), '.opencode', 'commands', 'pointed.md'));
  });

  it('registerMcp merges with existing opencode.json mcp servers', async () => {
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({
      mcp: { context7: { type: 'remote', url: 'x' } },
      otherTopLevel: { keep: true },
    }));
    const result = await opencodeAdapter.registerMcp('project', 7007);
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(process.cwd(), 'opencode.json'));
    const written = JSON.parse(mockedWriteFile.mock.calls[0][1]);
    expect(written.mcp.context7).toBeDefined();
    expect(written.mcp.pointer).toBeDefined();
    expect(written.mcp.pointer.command).toBe('npx');
    expect(written.otherTopLevel.keep).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试，3 失败**

- [ ] **Step 3: 写实现**

```ts
// packages/server/src/config/adapters/opencode.ts
import path from 'path';
import os from 'os';
import type { ToolAdapter, OperationResult } from '../types';
import { writeFileEnsuringDir, readJsonOrDefault } from '../adapter-helpers';
import { TRIGGER_NAME, TRIGGER_DESCRIPTION, TRIGGER_BODY } from '../trigger-content';

const MCP_SERVER_NAME = 'pointer';

function buildCommandFile(): string {
  return `---
description: ${JSON.stringify(TRIGGER_DESCRIPTION)}
---

${TRIGGER_BODY}`;
}

function userConfigPath(): string {
  return path.join(os.homedir(), '.config', 'opencode', 'opencode.json');
}

function projectConfigPath(): string {
  return path.join(process.cwd(), 'opencode.json');
}

export const opencodeAdapter: ToolAdapter = {
  toolId: 'opencode',
  displayName: 'OpenCode',

  async registerMcp(scope, port): Promise<OperationResult> {
    const filePath = scope === 'user' ? userConfigPath() : projectConfigPath();
    try {
      const existing = await readJsonOrDefault<Record<string, any>>(filePath, {});
      const existingMcp = (existing.mcp && typeof existing.mcp === 'object') ? existing.mcp : {};
      const merged = {
        ...existing,
        mcp: {
          ...existingMcp,
          [MCP_SERVER_NAME]: {
            type: 'local',
            command: ['npx', '-y', '@dom-pointer-mcp/server@latest', 'start'],
            environment: { MCP_POINTER_PORT: String(port) },
            enabled: true,
          },
        },
      };
      await writeFileEnsuringDir(filePath, JSON.stringify(merged, null, 2));
      return {
        status: 'success', scope, path: filePath,
        message: 'MCP server merged into opencode.json',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installTrigger(scope): Promise<OperationResult> {
    const filePath = scope === 'user'
      ? path.join(os.homedir(), '.config', 'opencode', 'commands', `${TRIGGER_NAME}.md`)
      : path.join(process.cwd(), '.opencode', 'commands', `${TRIGGER_NAME}.md`);
    try {
      await writeFileEnsuringDir(filePath, buildCommandFile());
      return { status: 'success', scope, path: filePath, message: 'Trigger command installed' };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },
};
```

- [ ] **Step 4: 跑测试 + 提交**

```bash
cd packages/server && pnpm test -- opencode.test
git add packages/server/src/config/adapters/opencode.ts packages/server/src/config/__tests__/adapters/opencode.test.ts
git commit -m "feat(config): add opencode adapter with mcp json merge"
```

---

## Task 9: JoyCode adapter（TDD，含 prompt.json 聚合 + trigger degrade）

**Files:**
- Create: `packages/server/src/config/__tests__/adapters/joycode.test.ts`
- Create: `packages/server/src/config/adapters/joycode.ts`

- [ ] **Step 1: 写 4 个失败测试**

```ts
// packages/server/src/config/__tests__/adapters/joycode.test.ts
import path from 'path';
import os from 'os';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
}));

import fs from 'fs/promises';
import { joycodeAdapter } from '../../adapters/joycode';

const mockedWriteFile = fs.writeFile as jest.Mock;
const mockedReadFile = fs.readFile as jest.Mock;

beforeEach(() => {
  mockedWriteFile.mockClear();
  mockedReadFile.mockClear();
  mockedReadFile.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
});

describe('joycodeAdapter', () => {
  it('registerMcp user writes ~/.joycode/joycode-mcp.json', async () => {
    const result = await joycodeAdapter.registerMcp('user', 7007);
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(os.homedir(), '.joycode', 'joycode-mcp.json'));
  });

  it('registerMcp project writes <cwd>/.joycode/mcp.json', async () => {
    const result = await joycodeAdapter.registerMcp('project', 7007);
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(process.cwd(), '.joycode', 'mcp.json'));
  });

  it('installTrigger project merges into prompt.json keeping other entries', async () => {
    mockedReadFile.mockResolvedValueOnce(JSON.stringify([
      { name: 'someOtherCommand', label: 'Other', prompt: 'x' },
      { name: 'pointerOld', label: 'Old', prompt: 'stale' },
    ]));
    const result = await joycodeAdapter.installTrigger('project');
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(process.cwd(), '.joycode', 'prompt.json'));
    const written = JSON.parse(mockedWriteFile.mock.calls[0][1]);
    expect(Array.isArray(written)).toBe(true);
    const names = written.map((e: any) => e.name);
    expect(names).toContain('someOtherCommand');
    expect(names).not.toContain('pointerOld');
    expect(names).toContain('pointerPointed');
  });

  it('installTrigger user degrades to project scope', async () => {
    const result = await joycodeAdapter.installTrigger('user');
    expect(result.status).toBe('degraded');
    expect(result.scope).toBe('project');
    expect(result.message).toMatch(/only supports project-level/i);
  });
});
```

- [ ] **Step 2: 跑测试，4 失败**

- [ ] **Step 3: 写实现**

```ts
// packages/server/src/config/adapters/joycode.ts
import path from 'path';
import os from 'os';
import type { ToolAdapter, OperationResult, Scope } from '../types';
import { writeFileEnsuringDir, readJsonOrDefault } from '../adapter-helpers';
import { TRIGGER_DESCRIPTION, TRIGGER_BODY } from '../trigger-content';

const MCP_SERVER_NAME = 'pointer';
const PROMPT_NAME = 'pointerPointed';
const POINTER_PREFIX = 'pointer';

function buildMcpJson(port: number) {
  return JSON.stringify({
    mcpServers: {
      [MCP_SERVER_NAME]: {
        command: 'npx',
        args: ['-y', '@dom-pointer-mcp/server@latest', 'start'],
        env: { MCP_POINTER_PORT: String(port) },
      },
    },
  }, null, 2);
}

function buildPromptEntry() {
  return {
    label: 'pointed',
    name: PROMPT_NAME,
    description: TRIGGER_DESCRIPTION,
    prompt: TRIGGER_BODY,
    source: 'project' as const,
  };
}

export const joycodeAdapter: ToolAdapter = {
  toolId: 'joycode',
  displayName: 'JoyCode',

  async registerMcp(scope, port): Promise<OperationResult> {
    const filePath = scope === 'user'
      ? path.join(os.homedir(), '.joycode', 'joycode-mcp.json')
      : path.join(process.cwd(), '.joycode', 'mcp.json');
    try {
      await writeFileEnsuringDir(filePath, buildMcpJson(port));
      return { status: 'success', scope, path: filePath, message: 'MCP server registered' };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installTrigger(scope): Promise<OperationResult> {
    const isDegraded = scope === 'user';
    const effectiveScope: Scope = 'project';
    const filePath = path.join(process.cwd(), '.joycode', 'prompt.json');
    try {
      const existing = await readJsonOrDefault<any[]>(filePath, []);
      const arr = Array.isArray(existing) ? existing : [];
      const filtered = arr.filter((e) =>
        !(e && typeof e === 'object'
          && typeof (e as any).name === 'string'
          && (e as any).name.startsWith(POINTER_PREFIX)),
      );
      const next = [...filtered, buildPromptEntry()];
      await writeFileEnsuringDir(filePath, JSON.stringify(next, null, 2));
      return {
        status: isDegraded ? 'degraded' : 'success',
        scope: effectiveScope,
        path: filePath,
        message: isDegraded
          ? 'JoyCode only supports project-level prompts; installed at project scope.'
          : 'Trigger prompt merged into .joycode/prompt.json',
      };
    } catch (e) {
      return {
        status: 'failed', scope: effectiveScope,
        message: `Write failed: ${(e as Error).message}`,
      };
    }
  },
};
```

- [ ] **Step 4: 跑测试 + 提交**

```bash
cd packages/server && pnpm test -- joycode.test
git add packages/server/src/config/adapters/joycode.ts packages/server/src/config/__tests__/adapters/joycode.test.ts
git commit -m "feat(config): add joycode adapter with prompt.json merge + user-trigger degrade"
```

---

## Task 10: adapter registry + configCommand 入口重写

**Files:**
- Create: `packages/server/src/config/adapters/index.ts`
- Modify: `packages/server/src/config.ts` (大瘦身)
- Modify: `packages/server/src/cli.ts` (加 --scope option)

- [ ] **Step 1: 写 adapters/index.ts**

```ts
// packages/server/src/config/adapters/index.ts
import type { ToolAdapter, ToolId } from '../types';
import { claudeAdapter } from './claude';
import { cursorAdapter } from './cursor';
import { windsurfAdapter } from './windsurf';
import { codexAdapter } from './codex';
import { opencodeAdapter } from './opencode';
import { joycodeAdapter } from './joycode';

const ADAPTERS: Record<ToolId, ToolAdapter> = {
  claude: claudeAdapter,
  cursor: cursorAdapter,
  windsurf: windsurfAdapter,
  codex: codexAdapter,
  opencode: opencodeAdapter,
  joycode: joycodeAdapter,
};

export function getAdapter(toolId: string): ToolAdapter | undefined {
  return ADAPTERS[toolId as ToolId];
}

export function listAdapters(): ToolAdapter[] {
  return Object.values(ADAPTERS);
}
```

- [ ] **Step 2: 读取现有 config.ts 确认结构**

Run: `cat packages/server/src/config.ts | head -40`

确认其顶部还有运行时 `MCPConfig` / `config` 常量被 `start.ts` 等使用。我们**只**重写 `configCommand` 函数，**保留** `MCPConfig` / `config` / `SupportedTool` enum / `showAvailableTools`。

- [ ] **Step 3: 替换 config.ts 末尾的 configCommand + 删除旧 configureXxx**

替换 `configCommand` 函数及之前的所有 `configureClaudeCode` / `configureCursor` / `configureWindsurf` / `showManualConfig` 函数（保留 `MCPConfig` 类型 + `config` 常量 + `SupportedTool` enum + `getPort` helper）。

新 `configCommand`：

```ts
import { getAdapter, listAdapters } from './config/adapters/index';
import { resolveScope } from './config/scope';
import type { OperationResult } from './config/types';

function printResult(label: string, r: OperationResult): void {
  const icon = r.status === 'success' ? '✅' : r.status === 'degraded' ? '⚠️' : r.status === 'skipped' ? '⏭️' : '❌';
  const where = r.path ? ` (${r.path})` : '';
  logger.info(`  ${icon} ${label}: ${r.message}${where}`);
}

export default async function configCommand(
  tool?: string,
  opts: { scope?: string } = {},
): Promise<void> {
  if (!tool) {
    showAvailableTools();
    return;
  }
  const adapter = getAdapter(tool);
  if (!adapter) {
    logger.error(`❌ Unsupported tool: ${tool}`);
    logger.error(`Supported tools: ${listAdapters().map((a) => a.toolId).join(', ')}`);
    process.exit(1);
  }
  let scope;
  try {
    scope = await resolveScope(opts.scope);
  } catch (e) {
    logger.error(`❌ ${(e as Error).message}`);
    process.exit(1);
  }
  const port = parseInt(getPort(), 10);
  logger.info(`🔧 Configuring DOM Pointer MCP for ${adapter.displayName} (${scope} scope)...`);

  const mcpResult = await adapter.registerMcp(scope, port);
  printResult('MCP server', mcpResult);
  const triggerResult = await adapter.installTrigger(scope);
  printResult('Trigger', triggerResult);

  if (mcpResult.status === 'failed' || triggerResult.status === 'failed') process.exit(1);
}
```

更新 `showAvailableTools`：

```ts
function showAvailableTools() {
  logger.info('📋 DOM Pointer MCP Configuration');
  logger.info('');
  logger.info('Usage: dom-pointer-mcp config <tool> [--scope user|project]');
  logger.info('');
  logger.info('Supported tools:');
  logger.info('  claude    - Claude Code (skill + MCP)');
  logger.info('  cursor    - Cursor IDE (rules + MCP)');
  logger.info('  windsurf  - Windsurf IDE (global_rules + MCP, user-only MCP)');
  logger.info('  codex     - OpenAI Codex CLI (TOML + prompt, user-only prompt)');
  logger.info('  opencode  - OpenCode (command + MCP)');
  logger.info('  joycode   - JoyCode (prompt.json + MCP, project-only prompt)');
  logger.info('');
  logger.info('Scope:');
  logger.info('  user      - install globally (default for non-interactive without --scope errors)');
  logger.info('  project   - install in current directory');
  logger.info('');
  logger.info('💡 If --scope is omitted, an interactive prompt asks you to choose.');
  logger.info('💡 Set MCP_POINTER_PORT env var to override default port 7007.');
}
```

**保留**（不删）：
- `MCPConfig` 接口 + `config` 常量 export（被 `start.ts` 等引用）
- `getPort()` helper（被新 configCommand 用）
- `SupportedTool` enum（在 cli.ts 没引用——可以删；保留无害）
- `import` 顶部凡 `execSync`/`os`/`fs`/`path` 等若不再用，删掉

- [ ] **Step 4: 修改 cli.ts 加 --scope option**

打开 `packages/server/src/cli.ts`，找到现有 `.command(\`${CLICommand.CONFIG} [tool]\`)` 那块，改为：

```ts
.command(`${CLICommand.CONFIG} [tool]`)
.option('--scope <scope>', 'Install scope: user or project (interactive if omitted)')
.description('Configure DOM Pointer MCP for AI tools')
.action(configCommand);
```

action 函数签名 commander 自动把 options 作为最后一个参数；我们的 configCommand 已经接收 `(tool, opts)`，匹配。

- [ ] **Step 5: typecheck + 跑测试**

```bash
pnpm typecheck
cd packages/server && pnpm test
```
Expected: 全绿 — 现有 server 测试 27 + 新增 ~24 = ~51 passed

- [ ] **Step 6: 提交**

```bash
git add packages/server/src/config.ts packages/server/src/cli.ts packages/server/src/config/adapters/index.ts
git commit -m "$(cat <<'EOF'
feat(config): wire adapter registry into config command with --scope option

configCommand now dispatches to per-tool adapters that handle both MCP
registration and trigger file installation. CLI gains --scope user|project
with interactive fallback when running in a TTY.

Legacy configureClaudeCode / configureCursor / configureWindsurf /
showManualConfig functions removed; their behavior is now in adapters.
EOF
)"
```

---

## Task 11: 手测验证

**Files:** 无

预备：
```bash
cd packages/server && pnpm build
# 或者把当前会话用的 dom-pointer-mcp 指到本地 dist/cli.cjs
```

- [ ] **Step 1: claude user scope**

```bash
node /Users/ymxfl/GithubStudy/dom-pointer-mcp/packages/server/dist/cli.cjs config claude --scope user
```
Expected:
- ✅ MCP server registered (claude mcp add -s user)
- ✅ Trigger skill installed (~/.claude/skills/pointed/SKILL.md)
- 验证 `claude mcp list` 含 pointer
- 验证 `cat ~/.claude/skills/pointed/SKILL.md` 含 frontmatter + body

- [ ] **Step 2: claude project scope（在新目录）**

```bash
mkdir -p /tmp/dom-pointer-mcp-test-claude && cd /tmp/dom-pointer-mcp-test-claude
node /Users/ymxfl/GithubStudy/dom-pointer-mcp/packages/server/dist/cli.cjs config claude --scope project
```
Expected:
- 新目录下出现 `.mcp.json` + `.claude/skills/pointed/SKILL.md`

- [ ] **Step 3: cursor user / project**

类似 Step 1/2，路径换成 `~/.cursor/...` 和 `<cwd>/.cursor/...`

- [ ] **Step 4: windsurf project（验证 MCP degrade）**

```bash
node .../cli.cjs config windsurf --scope project
```
Expected:
- ⚠️ MCP server: Windsurf does not support project-level MCP; installed at user scope (写到 `~/.codeium/windsurf/mcp_config.json`)
- ✅ Trigger rule installed at `<cwd>/.windsurf/rules/pointed.md`

- [ ] **Step 5: codex project（验证 trigger degrade）**

```bash
mkdir -p /tmp/dom-pointer-mcp-test-codex && cd /tmp/dom-pointer-mcp-test-codex
node .../cli.cjs config codex --scope project
```
Expected:
- ✅ MCP server merged into `.codex/config.toml`（项目内）
- ⚠️ Trigger: Codex only supports user-level prompts; installed at user scope（`~/.codex/prompts/pointed.md`）

验证 `cat .codex/config.toml` 含 `[mcp_servers.pointer]` 段。

- [ ] **Step 6: opencode user（验证 JSON merge）**

预备一个含其他字段的 `~/.config/opencode/opencode.json`：
```bash
mkdir -p ~/.config/opencode
echo '{"mcp":{"context7":{"type":"remote","url":"x"}},"keep":"me"}' > ~/.config/opencode/opencode.json
```

```bash
node .../cli.cjs config opencode --scope user
```
Expected:
- ✅ MCP merged into `~/.config/opencode/opencode.json`
- 验证 `cat ~/.config/opencode/opencode.json` 仍含 `context7` + `keep:"me"`，新增 `pointer` entry

- [ ] **Step 7: joycode user（验证 trigger degrade + prompt.json merge）**

```bash
mkdir -p /tmp/dom-pointer-mcp-test-joycode && cd /tmp/dom-pointer-mcp-test-joycode
echo '[{"name":"customA","label":"Custom","prompt":"x"}]' > .joycode/prompt.json 2>/dev/null || (mkdir -p .joycode && echo '[{"name":"customA","label":"Custom","prompt":"x"}]' > .joycode/prompt.json)
node .../cli.cjs config joycode --scope user
```
Expected:
- ✅ MCP server registered at `~/.joycode/joycode-mcp.json`
- ⚠️ Trigger: JoyCode only supports project-level prompts; installed at project scope
- 验证 `cat .joycode/prompt.json` 仍含 `customA`，新增 `pointerPointed`

- [ ] **Step 8: 交互模式**

```bash
node .../cli.cjs config claude
```
Expected: 提示 "Install scope: 1) user 2) project Choice [1-2]: " 接收 1 或 2

- [ ] **Step 9: --scope foo**

```bash
node .../cli.cjs config claude --scope foo
```
Expected: ❌ Invalid --scope: foo. Use 'user' or 'project'. exit 1

- [ ] **Step 10: 幂等性**

重复跑 Step 1 两次，输出一致，`.claude/skills/pointed/SKILL.md` 仍只有一个；`claude mcp list` pointer 只出现一次。

- [ ] **Step 11: 非 TTY**

```bash
cat /dev/null | node .../cli.cjs config claude
```
Expected: ❌ No --scope provided and no TTY... exit 1

- [ ] **Step 12: 端到端 — Claude 真识别 skill**

重启 Claude Code 后，跟 Claude 说"做一下"（你需要在浏览器先选好元素 + 输入备注）。
Expected: Claude 立刻调 `mcp__pointer__get-pointed-element`，不反问。

---

## Self-Review

**Spec coverage**：

| Spec 章节 | Task |
|---|---|
| types.ts (Scope/ToolId/Status/OperationResult/ToolAdapter) | 1 |
| adapter-helpers (writeFileEnsuringDir 等) | 1 |
| trigger-content 单一来源 | 2 |
| resolveScope (param + TTY) | 3 |
| claude adapter | 4 |
| cursor adapter | 5 |
| windsurf adapter + project-MCP degrade | 6 |
| codex adapter + TOML merge + project-trigger degrade | 7 |
| opencode adapter + JSON merge | 8 |
| joycode adapter + prompt.json 聚合 + user-trigger degrade | 9 |
| adapter 注册表 + configCommand 重写 + --scope option | 10 |
| 手测 12 条 | 11 |

**Placeholder 扫描**：所有 step 都有具体代码 / 命令 / 路径。

**类型一致性**：`ToolAdapter` / `Scope` / `OperationResult` / `MCP_SERVER_NAME='pointer'` 在所有 adapter 一致。`TRIGGER_NAME='pointed'` 跨 adapter 一致。文件路径常量在每个 adapter 内部封装。

无需调整。
