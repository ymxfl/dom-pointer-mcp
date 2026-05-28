# Slash Command + Skill 分离 设计

## 背景

`mcp-pointer config <tool>` 的当前 trigger 安装机制只装一种"trigger 文件"——本意是让 agent 看到用户的短指令时自动调 `mcp__pointer__get-pointed-element`。但实际场景里用户期望更明确的触发：在 agent 里打 `/pointed` 立即拿数据，可以加补充文字（`/pointed 顺便改成蓝色`）。

这种 **slash command** 触发方式比"看 description 命中"靠谱得多。同时 **skill**（description 触发）仍有价值——用户随口说"做一下"也能命中。两种共存。

而且不同 agent 对这两种机制的支持也不一样：

| Tool | 支持 slash command | 支持 description skill |
|---|---|---|
| Claude | ✅ `.claude/commands/` | ✅ `.claude/skills/` |
| Cursor | ✅ `.cursor/commands/` | ✅ `.cursor/rules/` |
| Windsurf | ✅ `.windsurf/workflows/` | ✅ `.windsurf/rules/` |
| Codex | ✅ `~/.codex/prompts/` | ❌ 无独立 skill |
| OpenCode | ✅ `.opencode/commands/` | ❌ 无独立 skill |
| JoyCode | ✅ `.joycode/prompt.json` 聚合 | ✅ `~/.joycode/skills/` |

现状漏装了 claude/cursor/windsurf 的 slash command（只装了 skill），joycode 漏装了 skill（只装了 slash command）。codex/opencode 已经装了 slash（因为它们的 prompts/commands 目录本就是 slash 机制），但被错误命名为"trigger skill"。

## 目标

把 ToolAdapter 接口拆成 `installCommand` + `installSkill?`，让每个 tool 装上**所有**它支持的触发机制。用户在 agent 里既可以打 `/pointed`，也可以用自然语言触发。

## 非目标

- 改变 `registerMcp` 的行为
- 改 scope/--scope 参数语义
- 在没有原生 skill 概念的 tool（codex/opencode）上模拟 skill
- 改变现有 trigger 文案的核心说明（拆 + 各取所需即可）

## 关键决策

| 维度 | 决定 |
|---|---|
| 接口变化 | `installTrigger` → `installCommand`（必须）+ `installSkill?`（可选） |
| 内容拆分 | `trigger-content.ts` 拆成 `COMMAND_*`（短 slash 描述）+ `SKILL_*`（完整描述触发指令） |
| 哪些 tool 实现 installSkill | claude / cursor / windsurf / joycode |
| 哪些 tool 不实现 | codex / opencode（无 skill 概念，installSkill 不导出） |
| Slash command 文案 | 短：1 句调 tool，1 句解释 userNote/elements，1 句解释额外文字是 refinement，1 句降级提示 |
| Skill 文案 | 现状 TRIGGER_BODY 完整保留，含多语言触发词列表 |
| configCommand 输出 | 装 3 件事：MCP / Slash command / Skill (if supported)，按 `✅⚠️❌` 打印每项结果 |

## 架构

```
mcp-pointer config <tool> [--scope user|project]
                  │
                  ▼
        resolveScope
                  │
                  ▼
          getAdapter(toolId)
                  │
        ┌─────────┼──────────────┬──────────────┐
        ▼         ▼              ▼              ▼
     registerMcp installCommand  installSkill?  (skip if not impl)
                  ▼              ▼
              printResult     printResult
```

## 文件清单

**修改**：
- `packages/server/src/config/types.ts` — `ToolAdapter` 拆 method
- `packages/server/src/config/trigger-content.ts` — 拆 `COMMAND_*` + `SKILL_*`，删除旧名
- `packages/server/src/config.ts` — `configCommand` 主流程加 installSkill 调用
- 6 个 adapter（`claude.ts/cursor.ts/windsurf.ts/codex.ts/opencode.ts/joycode.ts`）
  - 所有 6 个：`installTrigger` → `installCommand`，内容改为 slash command 文案
  - claude/cursor/windsurf/joycode：新增 `installSkill`
- 6 个 adapter 单元测试同步改：测试名 + 断言路径
- 4 个 adapter（claude/cursor/windsurf/joycode）单测新增 installSkill 用例

**新增**：无（接口扩展 + 已有文件内修改）

**不动**：
- shared / chrome-extension 包
- scope.ts / adapter-helpers.ts / adapters/index.ts
- cli.ts（已有 `--scope` 不动）

## 关键代码

### `types.ts`

```ts
export interface ToolAdapter {
  toolId: ToolId;
  displayName: string;
  registerMcp(scope: Scope, port: number): Promise<OperationResult>;
  installCommand(scope: Scope): Promise<OperationResult>;
  installSkill?(scope: Scope): Promise<OperationResult>;
}
```

### `trigger-content.ts`

```ts
// Shared name for both command and skill
export const TRIGGER_NAME = 'pointed';

// --- Slash command (打 /pointed 触发) ---
export const COMMAND_DESCRIPTION =
  'Fetch the user\'s currently pointed elements (set in browser via Option+Click) '
  + 'and act on their note. Any text after /pointed is treated as a refinement.';

export const COMMAND_BODY = `Call \`mcp__pointer__get-pointed-element\`. The returned payload has \`userNote\` (the user's primary instruction, typed in the browser before sending) and \`elements[]\` (DOM info per element). Treat \`userNote\` as the primary instruction and use \`elements[]\` to locate source files.

If the user typed extra text after \`/pointed\`, treat it as a refinement or follow-up to \`userNote\`.

If the tool returns "No selection pointed", tell the user to Option+Click elements in the browser, write a note, and press Cmd/Ctrl+Enter or Send.
`;

// --- Description-triggered skill (用户随口说话也命中) ---
export const SKILL_DESCRIPTION =
  'When the user issues a short request about elements they have selected in the '
  + 'browser via Option+Click (e.g. "做一下", "pointed", "改一下选中的", "看看选中的"), '
  + 'IMMEDIATELY call mcp__pointer__get-pointed-element without first asking for '
  + 'clarification. The returned payload has userNote (the user\'s actual request) and '
  + 'elements[] (DOM info per element including selector, cssProperties, and componentInfo '
  + 'with source file). Treat userNote as the primary instruction and use elements[] to '
  + 'locate the source code.';

export const SKILL_BODY = `# Pointed elements trigger

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

### Claude adapter（typical example）

```ts
async installCommand(scope): Promise<OperationResult> {
  const base = scope === 'user' ? os.homedir() : process.cwd();
  const filePath = path.join(base, '.claude', 'commands', `${TRIGGER_NAME}.md`);
  const body = `---
description: ${JSON.stringify(COMMAND_DESCRIPTION)}
---

${COMMAND_BODY}`;
  // write + return
}

async installSkill(scope): Promise<OperationResult> {
  const base = scope === 'user' ? os.homedir() : process.cwd();
  const filePath = path.join(base, '.claude', 'skills', TRIGGER_NAME, 'SKILL.md');
  const body = `---
name: ${TRIGGER_NAME}
description: ${JSON.stringify(SKILL_DESCRIPTION)}
---

${SKILL_BODY}`;
  // write + return
}
```

### configCommand 主流程

```ts
const mcpResult = await adapter.registerMcp(scope, port);
printResult('MCP server', mcpResult);

const commandResult = await adapter.installCommand(scope);
printResult('Slash command', commandResult);

if (adapter.installSkill) {
  const skillResult = await adapter.installSkill(scope);
  printResult('Skill', skillResult);
}

const failed = mcpResult.status === 'failed'
  || commandResult.status === 'failed'
  || (commandResult /* sentinel - cleaner: collect all results then check */);
// Real impl: collect all results, check any failed at end.
```

## 错误处理

- 任一结果 status='failed' → 进程 exit 1
- 任一 status='degraded' → ⚠️ 打印但不算失败
- `installSkill` 不存在（codex/opencode）→ 跳过，不报错
- 既有的幂等性合同对每个 install method 都成立

## 测试策略

### 单元测试调整

每个 adapter 测试文件改动：
1. 把现有 `installTrigger user/project` 测试改名为 `installCommand user/project`
2. 改路径断言：claude 改成 `.claude/commands/pointed.md`，cursor `.cursor/commands/pointed.md`，windsurf `.windsurf/workflows/pointed.md`，codex 不变（已是 prompts/），opencode 不变（已是 commands/），joycode 不变（已是 prompt.json）
3. 改内容断言：用 `COMMAND_DESCRIPTION` 而非 `TRIGGER_DESCRIPTION`

### 新增测试

claude / cursor / windsurf / joycode 各加 2 例 `installSkill` 测试（user / project scope + 路径 + 内容）。

### trigger-content.test.ts 更新

把 sanity 测试改为：检查 `COMMAND_BODY` 和 `SKILL_BODY` 都含 `mcp__pointer__get-pointed-element`；`SKILL_DESCRIPTION` 含触发词；`COMMAND_DESCRIPTION` 简短。

### 手测

实际启动 JoyCode / Claude，验证：
- 输入 `/pointed` → agent 立即调 tool
- `/pointed 改成蓝色` → tool 调用 + 把"改成蓝色"作为补充指令处理
- 说"做一下"（不打 slash）→ skill 路径触发

## 不在范围内

- 给 codex/opencode 模拟 skill 机制
- 改触发词集合
- slash command 内带参数处理（agent 自己看 body 提示理解）
- `--uninstall`

## 风险

| 风险 | 处置 |
|---|---|
| 接口重命名破坏未来 PR 的兼容 | adapter 内部接口，无外部 API 影响 |
| Windsurf workflow 文件路径假设错误 | 实现期手测验证，必要时降级 |
| 同时安装 skill + slash 让 agent 困惑 | 二者职责清晰：slash 显式触发、skill 描述触发，agent 文档已支持这种共存 |
