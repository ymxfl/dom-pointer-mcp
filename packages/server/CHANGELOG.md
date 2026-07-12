# @dom-pointer-mcp/server

## 1.7.2

### Patch Changes

- 274dfe5: Keep the note panel above large selection overlays, morph the Option+hover dashed outline between elements, and simplify selection visuals to a soft fill with light outer glow.

## 1.7.1

### Patch Changes

- dd2c56f: Add Agent install prompt in the Chrome extension popup, OpenCode skill install support, and `config --no-slash` for MCP + Skill only installs.

## 1.7.0

### Minor Changes

- 480aa1d: 支持检查更新：扩展可经 Chrome 应用商店或 GitHub Releases 检测新版本；server 提供 check-update MCP 工具、CLI update 命令，以及 /pointed update 参数模式。

## 1.6.1

### Patch Changes

- b93cd07: Wait for a server persistence ACK before reporting a selection as sent, show a success toast after confirmation, hide extension UI while capturing screenshots, attach saved screenshots as MCP image content, preserve visible/full text separately, filter kebab-case CSS correctly, move shared state to the platform temp directory, and report the real CLI/MCP server version with strict port validation.

## 1.5.3

### Patch Changes

- df7f097: Codex 配置改为安装 Skill 到 `~/.codex/skills/pointed/SKILL.md`，不再使用已废弃的 prompts 斜杠命令；同时修复 Claude、JoyCode、Codex 卸载 Skill 时残留空目录的问题（改为递归删除整个 skill 目录）。历史抽屉笔记新增 hover 提示，便于查看被截断的完整备注。

## 1.5.0

### Minor Changes

- f132b88: 新增选择历史、按需截图、历史抽屉回显与清理能力，并支持 iframe 内元素指向。

## 1.4.0

### Minor Changes

- a47f1ff: 组件提取器增加祖先链信息、返回完整源文件路径、自动跳过 node_modules 库组件

## 1.3.1

### Patch Changes

- fc75be0: 对齐 GitHub Release 与 npm 版本号

## 1.3.0

### Minor Changes

- c662488: GET 模式分平台适配确认工具（AskUserQuestion/task_ask_question/ask_question/request_user_input），前置模式判定防止模型跳过确认流程

## 1.2.2

### Patch Changes

- 7a49a8a: 修复 MCP 客户端退出后 server 进程残留问题（监听 stdin 关闭自动退出）；config 命令斜杠命令安装选项改为选择式交互

## 1.2.0

### Minor Changes

- 6383c64: feat: configurable trigger key with page-level conflict detection

  - Add user-configurable modifier key (Alt/Ctrl/Meta) in popup settings
  - Detect page-level keyboard event listeners via addEventListener interception
  - Show in-page toast notification with alternative key suggestion when conflict detected
  - Platform-aware display names (Option/Command on Mac, Alt/Win on Windows)

## 1.1.2

### Patch Changes

- 6bc0d3c: fix: rewrite prompt rules — userNote drives confirm/execute behavior, call tool with no args when params omitted

## 1.1.1

### Patch Changes

- fd2bd2b: fix: remove auto-trigger from skill description, unify skill/command prompt content, fix /pointed get skipping user confirmation, fix inconsistent cssLevel defaults, slim down MCP tool descriptions to reduce token usage

## 1.1.0

### Minor Changes

- 06d3274: feat(config): add /pointed get subcommand for preview-only inspection of selections
  docs: rewrite README to highlight Skill-based usage, clarify React ≤ 18 support

## 1.0.4

### Patch Changes

- 18a0730: Fix page scroll jump when selecting off-screen elements, guard sendElement against Service Worker init race

## 1.0.3

### Patch Changes

- d176e27: Fix page scroll jump when selecting off-screen elements, guard sendElement against Service Worker init race

## 1.0.2

### Patch Changes

- 57007a6: Fix off-screen note panel for viewport-filling elements, add automatic reconnect-and-retry on send failure, and support ESC to clear the current selection.

## 1.0.1

### Changes

- **MCP server key renamed** from `pointer` to `dom-pointer`. The tool surface
  is now `mcp__dom-pointer__get-pointed-element`. Existing client configs
  pointing at the old `"pointer"` key no longer match — re-run
  `npx @dom-pointer-mcp/server config <tool>` to refresh configs for Claude
  Code, Cursor, Codex, OpenCode, Windsurf, or JoyCode.
- **New positional shortcut** for `get-pointed-element`: trailing integers
  `0-3` in the user message (e.g. `/pointed 0 0`, `做一下 1 2`) map to the
  `textDetail` and `cssLevel` parameters and control returned payload size.
  - `textDetail`: 0 (no text) | 1 (visible only) | 2 (full, default)
  - `cssLevel`: 0 (no CSS) | 1 (layout) | 2 (+ box model) | 3 (full, default)
- Shared-state file path changed from `/tmp/mcp-pointer-shared-state.json` to
  `/tmp/dom-pointer-mcp-shared-state.json`. Stale files from the old path can
  be deleted.

## 1.0.0

Initial release.
