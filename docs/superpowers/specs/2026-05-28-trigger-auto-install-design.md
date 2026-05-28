# Trigger Auto-install 设计

## 背景

`mcp-pointer config <tool>` 当前只配置 MCP server 连接（让 agent 知道有 `mcp__pointer__get-pointed-element` 工具）。用户每次都得手动告诉 agent "去调 get-pointed-element 工具看看我选了什么"——这是个重复的口令，且 agent 经常会先反问而不是立即调用。

需求：扩展 `mcp-pointer config <tool>` 命令，让它在配置 MCP server 的同时**自动安装一份"触发文件"**（skill / command / rule，视工具而定），告诉 agent 当用户说短指令（如"做一下"、"pointed"）时**立即**调用 `mcp__pointer__get-pointed-element` 而不要反问。

## 目标

- 用一条 `mcp-pointer config <tool> [--scope user|project]` 命令完成 MCP server 注册 + trigger 文件落盘
- 支持 6 个 agent：claude / cursor / windsurf / codex / opencode / joycode
- 让用户在每个工具里都能用短指令触发 `get-pointed-element`，不需手动唤起

## 非目标

- 适配 OpenSpec 列表里其他 21 个 agent（YAGNI；adapter 模式留扩展点）
- `--uninstall` / `--list` 等额外 CLI 命令
- 一次性安装多个 tool（`config all`）
- 校验 trigger 文件是否真的被 agent 识别（这是 agent 内部行为，无法自动测）

## 关键设计决策

| 维度 | 决定 |
|---|---|
| 抽象层 | Adapter 模式（参考 OpenSpec），每个 tool 一个 file：`registerMcp(scope, port)` + `installTrigger(scope)` |
| Scope | 二选一：user / project；运行时由 `--scope` 参数或 TTY 交互决定 |
| TTY fallback | 无 `--scope` + 有 TTY → 弹菜单；无 `--scope` + 无 TTY → 报错 |
| Scope 降级 | 工具自身不支持选定 scope 时 fall back + warn（如 codex 项目级 trigger 不支持 → degrade 到用户级）|
| Trigger 内容 | 单一来源 `trigger-content.ts`，各 adapter 用自己的 frontmatter 包装 |
| 幂等性 | 重复运行结果一致；merge 现有配置不破坏其他字段 |
| MCP 注册策略 | 完整支持 6 个 agent 的两种 scope（windsurf 项目级 MCP 不支持 → degrade） |

## 架构

```
mcp-pointer config <tool> [--scope user|project]
                  │
                  ▼
        resolveScope (param > prompt > error)
                  │
                  ▼
          getAdapter(toolId)
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
adapter.registerMcp     adapter.installTrigger
   (MCP 配置)             (trigger 文件)
        │                   │
        └───────┬───────────┘
                ▼
        printResult (✅/⚠️/❌)
```

## 文件清单

**新增**：

```
packages/server/src/config/
├── types.ts                    # ToolAdapter / Scope / OperationResult
├── scope.ts                    # resolveScope: --scope + readline 交互
├── trigger-content.ts          # 单一来源的 trigger 文案
├── adapters/
│   ├── index.ts                # adapter 注册表
│   ├── claude.ts
│   ├── cursor.ts
│   ├── windsurf.ts
│   ├── codex.ts
│   ├── opencode.ts
│   └── joycode.ts
└── __tests__/
    ├── scope.test.ts
    ├── trigger-content.test.ts
    └── adapters/
        ├── claude.test.ts
        ├── cursor.test.ts
        ├── windsurf.test.ts
        ├── codex.test.ts
        ├── opencode.test.ts
        └── joycode.test.ts
```

**修改**：
- `packages/server/src/config.ts` — 大幅瘦身：只保留 `configCommand(tool, opts)` 入口、`SupportedTool` enum、`showAvailableTools`；删除现有的 `configureXxx` 函数（迁到 adapter）
- `packages/server/src/cli.ts` — `.command('config [tool]')` 加 `.option('--scope <scope>', '...')`
- `README.md` — `config` 命令新选项、6 tool 支持表、scope 含义

**不动**：
- `start.ts` / `services/` / `message-handler.ts` 等运行时代码
- shared / chrome-extension 包

## Tool 路径映射

| Adapter | MCP 用户级 | MCP 项目级 | Trigger 用户级 | Trigger 项目级 |
|---|---|---|---|---|
| **claude** | `claude mcp add -s user` (CLI) | `<cwd>/.mcp.json` | `~/.claude/skills/pointed/SKILL.md` | `<cwd>/.claude/skills/pointed/SKILL.md` |
| **cursor** | deeplink | `<cwd>/.cursor/mcp.json` | `~/.cursor/rules/pointed.mdc` | `<cwd>/.cursor/rules/pointed.mdc` |
| **windsurf** | `~/.codeium/windsurf/mcp_config.json` | ⚠️ 不支持 → user | `~/.codeium/windsurf/global_rules.md` (append) | `<cwd>/.windsurf/rules/pointed.md` |
| **codex** | `~/.codex/config.toml` (TOML merge) | `<cwd>/.codex/config.toml` | `~/.codex/prompts/pointed.md` (仅 user 支持) | ⚠️ → user |
| **opencode** | `~/.config/opencode/opencode.json` (mcp 字段 merge) | `<cwd>/opencode.json` | `~/.config/opencode/commands/pointed.md` | `<cwd>/.opencode/commands/pointed.md` |
| **joycode** | `~/.joycode/joycode-mcp.json` | `<cwd>/.joycode/mcp.json` | ⚠️ → project | `<cwd>/.joycode/prompt.json` (聚合 merge) |

### Scope 降级矩阵

| Adapter | User MCP | Project MCP | User Trigger | Project Trigger |
|---|---|---|---|---|
| claude | ✅ | ✅ | ✅ | ✅ |
| cursor | ✅ | ✅ | ✅ | ✅ |
| windsurf | ✅ | ⚠️ → user | ✅ | ✅ |
| codex | ✅ | ✅ | ✅ | ⚠️ → user |
| opencode | ✅ | ✅ | ✅ | ✅ |
| joycode | ✅ | ✅ | ⚠️ → project | ✅ |

## 关键代码

### `types.ts`

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
  registerMcp(scope: Scope, port: number): Promise<OperationResult>;
  installTrigger(scope: Scope): Promise<OperationResult>;
}
```

### `scope.ts`

```ts
import readline from 'readline';
import type { Scope } from './types';

export async function resolveScope(scopeArg?: string): Promise<Scope> {
  if (scopeArg) {
    if (scopeArg === 'user' || scopeArg === 'project') return scopeArg;
    throw new Error(`Invalid --scope: ${scopeArg}. Use 'user' or 'project'.`);
  }
  if (!process.stdin.isTTY) {
    throw new Error(
      "No --scope provided and no TTY for interactive prompt.\n"
      + "Please pass --scope user or --scope project.",
    );
  }
  return promptScope();
}

function promptScope(): Promise<Scope> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve, reject) => {
    rl.question(
      'Install scope:\n  1) user — global, all projects\n  2) project — current directory only\nChoice [1-2]: ',
      (answer) => {
        rl.close();
        const trimmed = answer.trim();
        if (trimmed === '1' || trimmed.toLowerCase() === 'user') resolve('user');
        else if (trimmed === '2' || trimmed.toLowerCase() === 'project') resolve('project');
        else reject(new Error(`Invalid choice: ${answer}`));
      },
    );
  });
}
```

### `trigger-content.ts`

```ts
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

### Adapter 范式（claude.ts 节选）

```ts
export const claudeAdapter: ToolAdapter = {
  toolId: 'claude',
  displayName: 'Claude Code',

  async registerMcp(scope, port) {
    if (scope === 'user') {
      try {
        try { execSync(`claude mcp remove ${MCP_SERVER_NAME} -s user`, { stdio: 'pipe' }); }
        catch { /* ignore */ }
        execSync(
          `claude mcp add ${MCP_SERVER_NAME} -s user --env MCP_POINTER_PORT=${port} `
          + `-- npx -y @mcp-pointer/server@latest start`,
          { stdio: 'pipe' },
        );
        return { status: 'success', scope, path: 'claude mcp add -s user',
                 message: 'MCP server registered (user scope)' };
      } catch (e) {
        return { status: 'failed', scope, message: `claude mcp add failed: ${(e as Error).message}` };
      }
    }
    const filePath = path.join(process.cwd(), '.mcp.json');
    await writeFileEnsuringDir(filePath, buildProjectMcpJson(port));
    return { status: 'success', scope, path: filePath, message: 'MCP server registered at .mcp.json' };
  },

  async installTrigger(scope) {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.claude', 'skills', TRIGGER_NAME, 'SKILL.md');
    await writeFileEnsuringDir(filePath, buildSkillFile());
    return { status: 'success', scope, path: filePath, message: 'Trigger skill installed' };
  },
};
```

### Codex 降级示例

```ts
async installTrigger(scope) {
  // Codex only supports user-level prompts
  const filePath = path.join(os.homedir(), '.codex', 'prompts', `${TRIGGER_NAME}.md`);
  await writeFileEnsuringDir(filePath, buildCodexPromptFile());
  const isDegraded = scope === 'project';
  return {
    status: isDegraded ? 'degraded' : 'success',
    scope: 'user',
    path: filePath,
    message: isDegraded
      ? 'Codex only supports user-level prompts; installed at user scope instead.'
      : 'Trigger prompt installed',
  };
}
```

### Joycode merge 示例

```ts
async installTrigger(scope) {
  const isDegraded = scope === 'user';
  const filePath = path.join(process.cwd(), '.joycode', 'prompt.json');
  let existing: any[] = [];
  try {
    const text = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) existing = parsed;
  } catch { /* missing or invalid: start fresh */ }
  const filtered = existing.filter((e) =>
    !(e && typeof e === 'object' && typeof e.name === 'string' && e.name.startsWith('pointer'))
  );
  const newEntry = {
    label: 'pointed',
    name: 'pointerPointed',
    description: TRIGGER_DESCRIPTION,
    prompt: TRIGGER_BODY,
    source: 'project',
  };
  await writeFileEnsuringDir(filePath, JSON.stringify([...filtered, newEntry], null, 2));
  return {
    status: isDegraded ? 'degraded' : 'success',
    scope: 'project',
    path: filePath,
    message: isDegraded
      ? 'JoyCode only supports project-level prompts; installed at project scope.'
      : 'Trigger prompt merged into .joycode/prompt.json',
  };
}
```

### Codex TOML merge

不引入新依赖，手写一段固定格式的 TOML section。读现有 `~/.codex/config.toml` 文本 → 若已含 `[mcp_servers.pointer]` 段 replace；否则 append。复杂 TOML 解析失败 → fail + 输出"please add manually" 加我们要加的段落。

### configCommand 入口

```ts
export default async function configCommand(
  tool?: string,
  opts: { scope?: string } = {},
) {
  if (!tool) { showAvailableTools(); return; }
  const adapter = getAdapter(tool);
  if (!adapter) { logger.error(`Unsupported tool: ${tool}`); process.exit(1); }

  let scope: Scope;
  try { scope = await resolveScope(opts.scope); }
  catch (e) { logger.error((e as Error).message); process.exit(1); }

  const port = parseInt(process.env.MCP_POINTER_PORT || '7007', 10);
  logger.info(`🔧 Configuring MCP Pointer for ${adapter.displayName} (${scope} scope)...`);

  const mcpResult = await adapter.registerMcp(scope, port);
  const triggerResult = await adapter.installTrigger(scope);

  printResult('MCP server', mcpResult);
  printResult('Trigger', triggerResult);

  if (mcpResult.status === 'failed' || triggerResult.status === 'failed') process.exit(1);
}
```

## 错误处理

| 场景 | 行为 |
|---|---|
| `--scope` 非法 | 立即报错退出 |
| 无 `--scope` + 非 TTY | 报错提示加 `--scope` |
| `--scope` 缺省 + 有 TTY | 交互菜单 |
| tool 名错 | 报错，显示支持列表 |
| 任一 result.failed | 进程 exit 1 |
| claude CLI 不存在 | result.failed，message 提示装 Claude Code CLI |
| 文件不可写 | result.failed，含原始 error |
| Codex TOML 复杂无法 merge | failed + 输出 "add manually" 段落 |
| Joycode prompt.json 损坏 | warn + 当作空数组重建 |
| Opencode opencode.json 含其他 mcp server | 保留其他，只更新 pointer |
| 重复运行 | 幂等：覆盖之前的安装 |

### 幂等性合同

所有 adapter 必须满足重复运行结果等价。实现策略：
- Claude user MCP: `claude mcp remove` 先清，再 add
- 项目级 JSON: read → merge → write
- Codex TOML: replace 已有段落
- Joycode: filter 旧 pointer entry → 加新

## 测试策略

### 单元测试（约 24 例）

**`scope.test.ts`（4）**
1. `--scope user` 参数 → 返回 'user'
2. `--scope project` → 'project'
3. `--scope foo` → throws
4. 无 `--scope` + 非 TTY → throws "no TTY"

**`trigger-content.test.ts`（1）**
- TRIGGER_DESCRIPTION 含关键词 sanity check（"pointed" / "Option+Click" / "userNote"）

**adapter tests（每 tool 3-4 例，共 ~20 例）**
- installTrigger user / project 路径 + 内容正确
- registerMcp project 写文件 + 内容正确
- registerMcp user 调 CLI / 写用户级文件
- 降级路径返回 'degraded' status + 正确 message

mock：`fs/promises` 全 mock，断言 `writeFile` path+content；`execSync` mock 避免真跑 CLI

### 不测的部分

- configCommand 主流程 CLI orchestration
- printResult 输出格式
- 真实 CLI 调用
- TTY 交互分支

### 手测清单（12 条）

1. `mcp-pointer config claude --scope user` → `claude mcp list` 含 pointer + `~/.claude/skills/pointed/SKILL.md`
2. `... --scope project`（新 dir）→ `.mcp.json` + `.claude/skills/pointed/SKILL.md`
3. `... cursor --scope user / project`
4. `... windsurf --scope project` → MCP degrade warn + project trigger
5. `... codex --scope project` → MCP `.codex/config.toml` + trigger degrade 到 user
6. `... opencode --scope user` → merge `~/.config/opencode/opencode.json`
7. `... joycode --scope user` → MCP `~/.joycode/joycode-mcp.json` + trigger degrade 到 project
8. `mcp-pointer config claude`（无 --scope）→ 弹交互
9. `... --scope foo` → 报错
10. 重复 1 → 幂等
11. `cat /dev/null | mcp-pointer config claude` 非 TTY → 报错
12. 实际启动 Claude → 短指令"做一下" → 验证自动调 `mcp__pointer__get-pointed-element`

## 不在本 spec 范围

- 适配其他 21 个 OpenSpec agent
- `--uninstall` / `--list` / `config all`
- 校验 trigger 文件被 agent 真识别
- 国际化触发词集合（spec 里只列举几个中英文示例）

## 风险

| 风险 | 影响 | 处置 |
|---|---|---|
| Codex TOML merge 误伤 | config.toml 被破坏 | 复杂结构 fail + 输出手动指引；不强行修改 |
| windsurf project MCP 真支持但 spec 写错 | 用户体验降级 | 实现期再验证，可能调整为真支持 |
| opencode user trigger 路径未验证 | 写到无用位置 | 实现期手测，必要时降级到 project |
| Trigger 文案对各 agent 触发效果不一致 | 短指令不触发 | 留作运营改进（修 trigger-content 即可，不改 adapter）|
| Joycode prompt.json 损坏被静默重建 | 用户旧 entry 丢失 | 至少 log warn；future：加 backup 文件 |
