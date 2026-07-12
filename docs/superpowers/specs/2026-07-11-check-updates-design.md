# 检查更新（Chrome 扩展 + MCP Server）设计

## 概述

为 DOM Pointer MCP 增加「检查更新」能力：

1. **Chrome 扩展**：支持 Chrome Web Store 与 GitHub Release 双通道。
2. **MCP Server**：通过 CLI / MCP tool / `/pointed update` skill 参数检查并可选应用更新。

## 背景与用户场景

| 用户 | 网络能力 | 期望 |
|------|----------|------|
| A | 可访问 Chrome 应用商店 | 通过 CWS 检测 / 触发 Chrome 原生更新 |
| B | 不可访问 CWS，可访问 GitHub | 通过 GitHub Releases 对比版本并给出下载链接 |
| 开发者 / Agent | 本地使用 server | 通过 `/pointed update` 检查 npm 上的 server 版本，必要时执行全局升级 |

## 决策与假设

1. **扩展不自动下载替换 unpacked 目录**：GitHub 通道只做版本对比 + 提供 zip / Release 链接；用户手动替换。
2. **CWS 通道**：调用 `chrome.runtime.requestUpdateCheck()`；有更新时引导用户到商店页或等待 Chrome 拉取。
3. **安装来源探测**：若可用则用 `chrome.management.getSelf().installType`（`normal` → CWS，`development`/`sideload` → GitHub）；不可用时走 `auto` 策略。
4. **`auto` 策略**：先尝试 CWS `requestUpdateCheck`；若不可用 / 失败 / 判定为非商店安装，再查 GitHub Releases。
5. **Server 更新通道**：查 npm registry `https://registry.npmjs.org/@dom-pointer-mcp/server/latest`（与现有 `npx @latest` 发布一致）。GitHub 仅作为扩展发布源。
6. **Skill 入口**：在现有 `/pointed` 模式体系中新增 **UPDATE mode**，参数：
   - `/pointed update` → `action=check`（默认）
   - `/pointed update apply` → `action=apply`
7. **apply 行为**：对全局安装执行 `npm install -g @dom-pointer-mcp/server@latest`；若当前进程由 `npx ...@latest` 启动，则报告「重启 MCP 即获取最新」，不强制本地升级。
8. **不新增 management 权限为硬依赖**：优先用 `requestUpdateCheck` + GitHub；`getSelf` 仅在 API 存在时使用（optional enhancement）。

## 方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| A. 仅 GitHub | 实现简单 | CWS 用户体验差，无法触发商店更新 |
| B. 仅 CWS | 商店用户体验好 | 无法服务国内/封锁商店用户 |
| **C. 双通道 auto（推荐）** | 覆盖两类用户 | 逻辑稍多，需清晰状态文案 |
| D. 独立 update skill | 职责分离 | 与用户「用 Pointed skill + update 参数」建议不符 |

**采用方案 C + Pointed UPDATE mode。**

## 架构

```
┌────────────────────────────┐       ┌─────────────────────────────┐
│ Chrome Extension Popup     │       │ MCP Server / CLI / Skill    │
│  - 显示当前版本             │       │  - MCP tool: check-update   │
│  - 「检查更新」按钮         │       │  - CLI: update [--apply]    │
│  - UpdateCheckService      │       │  - /pointed update [apply]  │
└────────────┬───────────────┘       └──────────────┬──────────────┘
             │                                      │
     ┌───────┴────────┐                    ┌────────┴────────┐
     ▼                ▼                    ▼                 ▼
 chrome.runtime   GitHub API           npm registry     npm install -g
 requestUpdateCheck  releases/latest   /latest          (apply only)
```

### Chrome 扩展

**新文件** `services/update-check-service.ts`：

```ts
type UpdateChannel = 'chrome-web-store' | 'github' | 'auto';
type UpdateStatus = 'checking' | 'up-to-date' | 'update-available' | 'error';

interface UpdateCheckResult {
  status: UpdateStatus;
  channel: 'chrome-web-store' | 'github';
  currentVersion: string;
  latestVersion?: string;
  updateUrl?: string;       // CWS 页或 zip / release 页
  messageKey: string;       // i18n key
  detail?: string;
}
```

常量：

- Repo: `ymxfl/dom-pointer-mcp`
- Release asset: `dom-pointer-mcp-chrome-extension.zip`
- CWS id: `jfhgaembhafbffidedhpkmnaajdfeiok`
- GitHub API: `https://api.github.com/repos/ymxfl/dom-pointer-mcp/releases/latest`
- tag_name 形如 `1.6.1`（semver，可直接比较）

**Popup**：在 server-status 下方增加 update 区域：当前版本 + 检查按钮 + 结果文案 / 打开链接。

**i18n**：中英文新增 `popup.update*` keys。

### MCP Server

**新文件** `services/update-service.ts`：

```ts
type UpdateAction = 'check' | 'apply';

interface ServerUpdateResult {
  action: UpdateAction;
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  launchHint: 'npx' | 'global' | 'unknown';
  applied?: boolean;
  message: string;
}
```

- `checkServerUpdate()`：读本地 `serverVersion`，fetch npm latest，semver 比较。
- `applyServerUpdate()`：先 check；若已最新则 no-op；若 `npx` 启发为 true 则只返回提示；否则 `npm install -g @dom-pointer-mcp/server@latest`。
- 启动方式启发：`process.argv` / `process.execPath` 是否含 npx 缓存路径，或 `npm_lifecycle_event`；保守默认 `unknown` 时 apply 仍尝试 global install 并说明可能需要重启。

**MCP tool** `check-update`：

```json
{
  "action": { "enum": ["check", "apply"], "default": "check" }
}
```

返回 JSON 文本 content。

**CLI** `dom-pointer-mcp update [--apply]`：打印人类可读结果，apply 失败非 0 退出。

**Pointed skill**（`trigger-content.ts`）：

```
If the first arg is `update`:
1. Call `check-update` IMMEDIATELY.
2. If second arg is `apply`, pass `{ action: "apply" }`; else `{ action: "check" }`.
3. Report versions and next steps. Do not modify project source files.
```

## 错误处理

- 网络失败：明确区分「无法访问 GitHub / npm / CWS」，给出另一通道提示（扩展侧）。
- semver 解析失败：视为 error，不误报「已最新」。
- `requestUpdateCheck` 返回 `throttled`：提示稍后再试，可仍展示 GitHub 对比结果（若有）。

## 测试

- 扩展：`update-check-service` 单测（mock fetch / chrome.runtime）。
- Server：`update-service` 单测（mock registry / child_process）。
- Skill：`trigger-content` 断言含 UPDATE mode 与 `check-update`。
- MCP：list/call tool 行为单测（若现有 mcp-service 测试模式可复用）。

## 非目标

- 自动静默替换 unpacked 扩展文件。
- 通过 GitHub 更新 server（server 发布源是 npm）。
- 独立新 skill 名称（保持 `/pointed update`）。
- 强制申请 `management` 权限。

## 验收标准

1. Popup 可显示当前版本，点击「检查更新」在 CWS 或 GitHub 至少一条可达路径上得到明确结果。
2. 无法访问 CWS 但可访问 GitHub 时，仍能发现新版本并给出 zip/Release 链接。
3. `/pointed update` 调用 `check-update`；`/pointed update apply` 可触发全局升级或给出 npx 重启提示。
4. `dom-pointer-mcp update` / `update --apply` 可用。
5. 中英文 UI 文案齐全；现有测试 + 新增测试通过。
