# Chrome 扩展国际化设计

## 概述

为 Chrome 扩展添加中英文国际化支持。用户可在 Popup 设置页手动切换语言，默认中文。

## 需求

- 支持中文（默认）和英文两种语言
- 用户在 Popup 设置页通过下拉框手动切换语言
- manifest.json 的 name/description 通过 Chrome 原生 `_locales/` 机制跟随浏览器语言
- 插件内 UI 文案通过自定义 i18n 模块实现，不依赖浏览器特定 API（保证跨浏览器兼容）
- 语言切换后，Popup 立即生效；Content Script 中的 Note Panel / Toast 等在下次渲染时生效

## 架构

### 翻译文件结构

```
src/i18n/
  index.ts      — 导出 t()、setLocale()、getLocale()
  zh.ts         — 中文翻译对象
  en.ts         — 英文翻译对象
src/_locales/
  zh_CN/messages.json   — manifest 级别中文
  en/messages.json      — manifest 级别英文
```

### i18n 核心模块 (`src/i18n/index.ts`)

- `Locale` 类型：`'zh' | 'en'`
- `t(key, params?)` — 根据当前 locale 返回翻译文案，支持 `{param}` 插值
- `setLocale(locale)` — 设置当前语言
- `getLocale()` — 获取当前语言
- 翻译 key 类型安全，基于 `typeof zh` 推导 `MessageKey`

### 翻译 key 命名规范

扁平 key-value 结构，`模块.描述` 格式：

```
popup.title
popup.enabled
popup.save
notePanel.placeholder
notePanel.send
conflict.warning
extension.reloaded
```

### 插值语法

`{paramName}` — 在 `t()` 调用时传入 params 对象替换：

```ts
t('popup.serverReachable', { port: 7007 })
// → '端口 7007 可达'
```

## 语言偏好存储

复用现有 `ExtensionConfig`，新增 `locale` 字段：

```ts
export type Locale = 'zh' | 'en';

interface ExtensionConfig {
  enabled: boolean;
  locale: Locale;           // 新增，默认 'zh'
  websocket: { port: number };
  logger: { enabled: boolean; level: string };
  behavior: { clearAfterSend: boolean };
  trigger: { modifierKey: ModifierKey };
}
```

`defaultConfig.locale` 设为 `'zh'`。

## 需要改造的文件

### Popup 页面

- **`popup.html`**：移除所有硬编码文案，标签和按钮文字留空或用 id 标记
- **`popup-manager-service.ts`**：
  - `loadConfig` 时调用 `setLocale(config.locale)` 然后用 `t()` 填充所有文本节点
  - 新增语言下拉框（`<select id="locale">`）和对应逻辑
  - `saveConfig` / `resetToDefaults` / `showStatus` / `setStatus` / `checkConflict` 中所有文案改用 `t()`

### Content Script

- **`note-panel-service.ts`**：
  - `buildPanel` 中 innerHTML 里的文案（placeholder、Send、Copy、hint、Close title）改用 `t()`
  - `handleSend` / `handleCopy` 错误文案改用 `t()`
  - `flashCopyFeedback` 中 'Copy' / 'Copied!' 改用 `t()`
- **`element-pointer-service.ts`**：
  - `EXTENSION_RELOADED_MESSAGE` 改用 `t('extension.reloaded')`
- **`conflict-detection-service.ts`**：
  - `detectConflict` 中的冲突提示文案改用 `t()`
- **`content.ts`**：
  - `checkConflictOnLoad` 中 toast action label '去设置' 改用 `t()`
  - 启动时从 config 读取 locale 并调用 `setLocale()`
  - `ConfigStorageService.onChange` 中同步更新 locale

### manifest.json

- `name` 改为 `__MSG_appName__`
- `description` 改为 `__MSG_appDescription__`
- 添加 `default_locale: "zh_CN"`

### `_locales/` 文件

**zh_CN/messages.json**:
```json
{
  "appName": { "message": "DOM Pointer MCP" },
  "appDescription": { "message": "为你的 AI 编程工具指向 DOM 元素" }
}
```

**en/messages.json**:
```json
{
  "appName": { "message": "DOM Pointer MCP" },
  "appDescription": { "message": "Point to DOM elements for your agentic coding tools" }
}
```

## 翻译文案清单

### 中文 (zh.ts)

| Key | 文案 |
|-----|------|
| popup.title | DOM Pointer MCP 设置 |
| popup.enabled | 启用扩展 |
| popup.clearAfterSend | 发送后清除选区 |
| popup.triggerKey | 触发键 |
| popup.triggerKeyHint | 按住此键进入指向模式 |
| popup.port | MCP 服务端口 |
| popup.portHint | 连接 MCP 服务的 WebSocket 端口 |
| popup.save | 保存设置 |
| popup.reset | 恢复默认 |
| popup.language | 语言 |
| popup.serverChecking | 正在检查服务... |
| popup.serverReachable | 端口 {port} 可达 |
| popup.serverUnreachable | 无法连接端口 {port} |
| popup.savedSuccess | 设置已保存 |
| popup.resetSuccess | 已恢复默认设置 |
| popup.portError | 端口必须在 1-65535 之间 |
| popup.loadError | 加载配置失败 |
| popup.saveError | 保存配置失败 |
| popup.resetError | 重置配置失败 |
| popup.invalidPort | 无效端口: {port} |
| notePanel.placeholder | 描述你想要的修改... |
| notePanel.send | 发送 |
| notePanel.copy | 复制 |
| notePanel.copied | 已复制! |
| notePanel.hint | ⌘/Ctrl+Enter 发送 |
| notePanel.sendFailed | 发送失败: {error} |
| notePanel.copyFailed | 复制失败: {error} |
| notePanel.closeTitle | 清除所有选区 |
| conflict.warning | {key} 键可能被当前页面占用，建议切换为 {suggested} |
| conflict.warningNoSuggestion | {key} 键可能被当前页面占用 |
| conflict.toastAction | 去设置 |
| extension.reloaded | 扩展已重载或更新，请刷新页面以重新连接。 |

### 英文 (en.ts)

| Key | 文案 |
|-----|------|
| popup.title | DOM Pointer MCP Settings |
| popup.enabled | Extension Enabled |
| popup.clearAfterSend | Clear selection after Send |
| popup.triggerKey | Trigger Key |
| popup.triggerKeyHint | Hold this key to enter pointing mode |
| popup.port | MCP Server Port |
| popup.portHint | Port for WebSocket connection to MCP server |
| popup.save | Save Settings |
| popup.reset | Reset to Defaults |
| popup.language | Language |
| popup.serverChecking | Checking server... |
| popup.serverReachable | Reachable on port {port} |
| popup.serverUnreachable | Cannot reach server on port {port} |
| popup.savedSuccess | Settings saved successfully |
| popup.resetSuccess | Settings reset to defaults |
| popup.portError | Port must be a number between 1 and 65535 |
| popup.loadError | Failed to load configuration |
| popup.saveError | Failed to save configuration |
| popup.resetError | Failed to reset configuration |
| popup.invalidPort | Invalid port: {port} |
| notePanel.placeholder | Describe what you want to change... |
| notePanel.send | Send |
| notePanel.copy | Copy |
| notePanel.copied | Copied! |
| notePanel.hint | ⌘/Ctrl+Enter to send |
| notePanel.sendFailed | Send failed: {error} |
| notePanel.copyFailed | Copy failed: {error} |
| notePanel.closeTitle | Clear all selections |
| conflict.warning | {key} may be used by this page. Suggested: {suggested} |
| conflict.warningNoSuggestion | {key} may be used by this page. |
| conflict.toastAction | Settings |
| extension.reloaded | Extension was reloaded or updated. Please refresh this page to reconnect. |

## 构建配置

`_locales/` 目录需要在构建时复制到 dist 输出目录。检查现有的构建脚本（esbuild / rollup），确保 `_locales/` 被正确处理。

## 不在范围内

- 不支持中英文以外的语言
- 不做语言切换后已渲染 UI 的即时更新
- 不做 RTL 布局支持
