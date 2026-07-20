# @dom-pointer-mcp/chrome-extension

## 1.7.3

### Patch Changes

- 8273279: 修复扩展版本号显示错误：GitHub Release 现始终以扩展自身版本号命名，不再借用 server 版本，避免"检查更新提示新版但装上仍是旧版"的死循环。Agent 安装命令指定官方镜像源 `--registry=https://registry.npmjs.org/`，避免从私有镜像装到陈旧的 server。检查更新改为从 releases 列表挑选纯 semver 标签的最新 Release，server 单独发版不再干扰扩展更新检查。

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

## 1.6.0

### Minor Changes

- 5f1fff2: 新增方向键导航选择框功能：选中元素后可使用方向键在相邻 DOM 节点间移动选区，发送/复制选区时按引用去重合并。

## 1.5.3

### Patch Changes

- df7f097: Codex 配置改为安装 Skill 到 `~/.codex/skills/pointed/SKILL.md`，不再使用已废弃的 prompts 斜杠命令；同时修复 Claude、JoyCode、Codex 卸载 Skill 时残留空目录的问题（改为递归删除整个 skill 目录）。历史抽屉笔记新增 hover 提示，便于查看被截断的完整备注。

## 1.5.2

### Patch Changes

- 2e9340d: 设置弹窗标题栏新增「关于」图标，点击可在新标签页打开 GitHub 仓库。

## 1.5.1

### Patch Changes

- bce7e29: 笔记面板支持鼠标拖动：按住面板空白处即可拖动到任意位置，避免遮挡想要选择的其他元素，拖动后不再自动吸附到选中元素。

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

- c662488: Chrome 扩展全面国际化：Popup、Content Script、manifest 支持中英文切换

## 1.2.1

### Patch Changes

- dd34422: 修复 HTTP 页面上复制按钮报错的问题，当 navigator.clipboard 不可用时降级使用 execCommand

## 1.2.0

### Minor Changes

- 6383c64: feat: configurable trigger key with page-level conflict detection

  - Add user-configurable modifier key (Alt/Ctrl/Meta) in popup settings
  - Detect page-level keyboard event listeners via addEventListener interception
  - Show in-page toast notification with alternative key suggestion when conflict detected
  - Platform-aware display names (Option/Command on Mac, Alt/Win on Windows)

## 1.1.3

### Patch Changes

- 9065d2d: Add fallback for `crypto.randomUUID` in non-secure contexts (e.g. plain HTTP)

## 1.1.0

### Patch Changes

- 06d3274: feat(config): add /pointed get subcommand for preview-only inspection of selections
  docs: rewrite README to highlight Skill-based usage, clarify React ≤ 18 support

## 1.0.4

### Patch Changes

- 18a0730: Fix page scroll jump when selecting off-screen elements, guard sendElement against Service Worker init race

## 1.0.3

### Patch Changes

- d176e27: Fix page scroll jump when selecting off-screen elements, guard sendElement against Service Worker init race

## 1.0.1

### Changes

- Updated tool reference in code comments to `mcp__dom-pointer__get-pointed-element`
  to match the renamed MCP server key (see `@dom-pointer-mcp/server` 1.0.1).
- No behavioral changes in the extension itself.

## 1.0.0

Initial release.
