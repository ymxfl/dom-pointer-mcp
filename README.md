<img width="1440" height="480" alt="DOM Pointer MCP banner" src="https://github.com/user-attachments/assets/a36d2666-e848-4a80-97b3-466897b244f7" />

[![CI](https://github.com/ymxfl/dom-pointer-mcp/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ymxfl/dom-pointer-mcp/actions/workflows/ci.yml)
[![Release](https://github.com/ymxfl/dom-pointer-mcp/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/ymxfl/dom-pointer-mcp/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/@dom-pointer-mcp/server?label=Server)](https://www.npmjs.com/package/@dom-pointer-mcp/server)
[![Chrome Extension](https://img.shields.io/github/package-json/v/ymxfl/dom-pointer-mcp?filename=packages%2Fchrome-extension%2Fpackage.json&label=Chrome-Extension)](https://github.com/ymxfl/dom-pointer-mcp/releases)
[![License: MIT](https://img.shields.io/github/license/ymxfl/dom-pointer-mcp?label=License)](https://github.com/ymxfl/dom-pointer-mcp/blob/main/LICENSE)

**Languages**: **简体中文** · [English](./README.en.md)

# 👆 DOM Pointer MCP

**通过 MCP 协议把浏览器里 DOM 元素的"上下文"交给 AI 编码工具！**

DOM Pointer MCP 是一个 *本地* 工具，由 MCP Server 和 Chrome 扩展两部分组成：

1. **🖥️ MCP Server**（Node.js 包）—— 通过 Model Context Protocol 在浏览器与 AI 工具之间架桥
2. **🌐 Chrome 扩展** —— 通过 `Option+Click`（macOS）/ `Alt+Click`（Windows）在浏览器中圈选 DOM 元素

扩展负责让你"指"出页面上的元素，server 把这些**文本化的上下文**通过标准 MCP 工具暴露给 Claude Code、Cursor、Windsurf 等 agentic 编码工具。

## ✨ 特性

- 🎯 **`Option+Click` 选择** —— 按住 `Option`（Windows 上是 `Alt`）点击任意元素
- 🧺 **多选 Batch** —— 多个元素叠加成一个 batch，配一段共享的 note 一起发送
- 📝 **浮动 Note Panel** —— 在选中区域旁边写自由文本说明，可 Send 或 Copy
- 📋 **完整元素数据** —— 文本内容、CSS 类、HTML 属性、定位、样式等
- 💡 **按需控制上下文体量** —— 每次 MCP 调用可选只要可见文本、不要文本、CSS 详略 0–3
- ⚛️ **组件信息识别** —— 通过运行时反射拿到 React / Vue 2 / Vue 3 的组件名和源文件（实验性）
- 🟢 **服务端状态指示** —— 弹窗会探测 MCP server，发不出去之前你就能看到红灯
- 🛠️ **交互式多 Agent 配置** —— 一条 `config` 命令为 Claude Code、Cursor、Windsurf、Codex、Opencode、JoyCode 安装/卸载 MCP + 斜杠命令 + skill
- 🔗 **WebSocket 通信** —— 浏览器和 AI 工具间实时通信
- 🤖 **MCP 兼容** —— 支持 Claude Code 及其他 MCP-enabled 工具

## 🎬 使用示例（视频）

https://github.com/user-attachments/assets/98c4adf6-1f05-4c9b-be41-0416ab784e2c

`Option+Click` 任意元素，然后让你的 AI（示例中是 Claude Code）针对它做事。AI 会拿到该元素完整的文本化上下文：CSS、URL、selector 等。

## 🚀 快速开始

### 1. 安装 Chrome 扩展

从 GitHub Release 下载安装：

1. 从 [最新 release](https://github.com/ymxfl/dom-pointer-mcp/releases/latest) 下载 [`dom-pointer-mcp-chrome-extension.zip`](https://github.com/ymxfl/dom-pointer-mcp/releases/latest/download/dom-pointer-mcp-chrome-extension.zip)
2. 解压到本地任意目录
3. Chrome → 设置 → 扩展程序 → 开启 **开发者模式**
4. 点击"加载已解压的扩展程序"，选择解压目录
5. 工具栏出现 DOM Pointer MCP 图标
6. **刷新已打开的网页** 让扩展生效

> **⚠️ 版本兼容：** Chrome 扩展和 MCP server 同步发版。升级时请把两边都升到同一个版本，避免协议格式不一致。

<details>
<summary>从源码构建</summary>

1. 克隆本仓库
2. 按 [CONTRIBUTING.md](./CONTRIBUTING.md) 构建
3. Chrome → 设置 → 扩展程序 → 开启 **开发者模式**
4. 点击"加载已解压的扩展程序"，选择 `packages/chrome-extension/dist/`
5. **刷新已打开的网页** 让扩展生效

</details>

### 2. 配置 MCP Server

`config` 命令会为你选中的 AI 工具安装 MCP server 注册项、可选的 `/pointed` 斜杠命令，以及（支持的工具）skill。

**交互式（推荐）：**

```bash
npx -y @dom-pointer-mcp/server config
```

会依次问你：

1. **Action** —— Install 还是 Uninstall。
2. **Agents** —— 多选：Claude Code、Cursor、Windsurf、Codex、Opencode、JoyCode 任意组合。
3. **Scope** —— `user`（全局）或 `project`（仅当前目录）。
4. **启动方式** —— `npx`（每次从 registry 获取最新）或 `global`（使用本地已安装的 bin，离线可用）。
5. **Slash command?** —— 一个 y/N 同时套用于所有选中的 agent。

每个 agent 会按 `installed` / `degraded` / `skipped` / `failed` 分项报告，让你看清楚到底落到哪里。

> **💡 切换为英文界面：** 加 `--lang en` 即可，如 `npx -y @dom-pointer-mcp/server config --lang en`。

<details>
<summary>非交互式（脚本 / CI）</summary>

```bash
# 安装单个 agent（旧用法仍可用）
npx -y @dom-pointer-mcp/server config claude       # 也支持 cursor / windsurf / codex / opencode / joycode
npx -y @dom-pointer-mcp/server config claude --scope project

# 使用全局安装的 bin（不走 npx fetch，离线可用）
npx -y @dom-pointer-mcp/server config claude --scope user --global

# 卸载（对称：清掉 MCP 注册、skill、斜杠命令）
npx -y @dom-pointer-mcp/server config --uninstall            # 交互式卸载
npx -y @dom-pointer-mcp/server config --uninstall claude     # 单个 agent，默认 user scope
npx -y @dom-pointer-mcp/server config --uninstall claude --scope project
```

> Project scope 的安装记录会留在当时安装的目录里；要卸载只能 `cd` 回去再 `--scope project`。交互式卸载默认只动 user scope，是有意为之。

</details>

<details>
<summary>全局安装模式（推荐私服 / 离线环境）</summary>

如果你的网络环境无法顺畅访问 npm registry（如企业私服同步延迟），可以先全局安装再用 `--global` 模式配置：

```bash
# 1. 全局安装（仅需一次）
npm install -g @dom-pointer-mcp/server

# 2. 配置时选择 global 模式
dom-pointer-mcp config --global
# 或非交互式
dom-pointer-mcp config claude --scope user --global
```

这样 AI 工具启动 MCP server 时会直接调用本地已安装的 `dom-pointer-mcp` 命令，不再每次 fetch registry。

升级时只需：
```bash
npm update -g @dom-pointer-mcp/server
```

</details>

配置完成后，**重启 AI 工具** 让 MCP 连接生效。

> **🔄 已经在用 DOM Pointer MCP？** 再跑一次 config 升级到 v1.0+ 的增量 MCP 注册逻辑——已有的 `~/.mcp.json` 等会被合并而不是覆盖。

### 3. 开始使用

1. **打开任意网页**
2. **`Option+Click`** 选中元素
3. **让 AI 分析** 你刚才点选的元素

AI 工具会在需要的时候用 `npx -y @dom-pointer-mcp/server@latest start` 自动拉起 MCP server。

**可用 MCP 工具：**
- `get-pointed-element` —— 返回当前选中 batch：`{ userNote, url, timestamp, elements: [...] }`。可选参数：
  - `textDetail`：`0 | 1 | 2`（默认 `2`），控制每个元素的文本详略（`0 = 不含`，`1 = 仅可见文本`，`2 = 可见 + 隐藏`）。
  - `cssLevel`：`0 | 1 | 2 | 3`（默认 `1`），控制每个元素的样式详略，从无 CSS（0）到完整 computed style（3）。

## 🎯 工作流程

1. **按住 Option (Alt) 点击** 页面元素 —— 元素被选中并高亮。
2. *（可选）* 继续按住 Option 点更多元素 —— 多选叠加成一个 batch。
3. 第一个选中的元素旁会出现 **浮动 note panel**，里面有 textarea 和三个按钮。
4. 写下你想要的改动（例如 "make these buttons primary blue"、"in [1] and [2] add a divider"）。
5. **Send**（`⌘/Ctrl+Enter`）把选区 + note 发到 MCP server；**Copy** 把同样的内容拷到剪贴板；**×** 关闭面板。
6. AI 调用 `get-pointed-element` 拿到 `{ userNote, url, timestamp, elements: [...] }`。

要取消某个选中：再次 Option+Click 该元素，或者点 chip 上的 ×。Note panel 会一直保留，直到 **所有** 选中都被取消 —— 防止你正在写的文本被误点丢掉。

打开扩展弹窗时会自动探测已配置的 server 并显示 🟢 / 🔴 状态指示，让你在按 Send 之前就知道 server 还在不在。

> **⚠️ v0.7 破坏性变更：** 通信格式从"单元素"切换为"选区 batch"（`{ userNote, elements }`）。扩展和 server 必须 **同版本**。原先消费旧 `get-pointed-element` 单对象格式的 agent prompt 需要改成处理新的 batch 结构。

## 🎨 提取的元素数据

- **User Note**：用户为整个 batch 写的描述
- **Basic Info**：tag name、id、class、文本内容（逐元素）
- **CSS Properties**：display、position、颜色、尺寸（逐元素）
- **Component Info**：React / Vue 组件名和源文件（实验性）
- **Attributes**：所有 HTML 属性
- **Position**：精确的坐标和尺寸
- **Source Hints**：源文件路径和组件来源

## 🔍 框架支持

- ⚛️ **React** —— 通过 Fiber 获取组件名和源文件（实验性）。提取器会向上走 `fiber.return`，所以即便你点中的是包装 DOM，也能解析到最近的组件祖先。
- 🟢 **Vue 2 / Vue 3** —— 通过运行时实例获取组件名和源文件（实验性；Vue 只给文件名，没有行号）。同版本约束：页面里的 Vue 主版本号要和提取器期望一致。
- 📦 **原生 HTML/CSS/JS** —— 完全支持。

组件信息提取在页面的 MAIN world 跑（这样才能读 React Fiber / Vue 内部数据），通过一个小的请求/响应协议桥接到扩展的 ISOLATED world。

## 🌐 浏览器支持

- ✅ **Chrome** —— 完全支持（经过测试）
- 🟡 **基于 Chromium 的浏览器** —— 应该可以用（Edge、Brave、Arc——需要手动加载构建产物）

## 🐛 故障排查

### 扩展连不上

1. 确认 MCP server 已启动：`npx -y @dom-pointer-mcp/server@latest start`
2. 查看浏览器控制台的 WebSocket 报错
3. 确认 7007 端口没有被防火墙拦截

### AI 工具看不到 MCP 工具

1. 配置后重启 AI 工具
2. 再跑一次 `npx -y @dom-pointer-mcp/server config`，确认你的工具同时显示 MCP（和可选的斜杠命令）为 `installed`
3. 确认 server 在跑：`npx -y @dom-pointer-mcp/server@latest start`

### 弹窗显示 "Server unreachable"

1. 弹窗探测的端口就是输入框里那个 —— 确认和 server 实际绑定端口一致（默认 `7007`）。
2. 启动 server 后点 **Recheck** 重试。
3. 如果改了端口，点 **Save** 保存，会自动重新探测。

### 元素不高亮

1. 某些页面会屏蔽 content script（`chrome://` 等）
2. 试着刷新页面
3. 通过扩展图标确认 targeting 是开着的

## 🚀 Roadmap

### 1. **Dynamic Context Control**
   - 完整原始上下文回传 server
   - LLM 可选的详略级别（仅可见文本、全部文本、CSS 等级）
   - 渐进式精化 / 按 token 量取数据

### 2. **Visual Content Support**（面向多模态 LLM）
   - 图片（img tag）转 base64
   - 选中元素截图
   - 提供独立的视觉内容 MCP 工具

### 3. **更好的框架支持**
   - 进一步增强 React 支持（React 19 移除了 `_debugSource`，dev 构建里的源映射受影响）
   - Svelte / Solid 组件识别

### 4. **多选**
   - 已支持多个 DOM 元素同时选中
   - https://github.com/ymxfl/dom-pointer-mcp/pull/9

## 📝 许可证

MIT License —— 详见 LICENSE 文件

## 🤝 贡献

欢迎贡献！开发环境与流程见 [CONTRIBUTING.zh-CN.md](./CONTRIBUTING.zh-CN.md)（或英文版 [CONTRIBUTING.md](./CONTRIBUTING.md)）。

---

## 🙏 致谢

DOM Pointer MCP 基于 [MCP Pointer](https://github.com/etsd-tech/mcp-pointer)（作者 [Elie](https://github.com/Eliethesaiyan)）fork 而来。向原作者致以最深的感谢——没有他们的工作就没有这个项目。

---

*灵感来自 [Click-to-Component](https://github.com/ericclemmons/click-to-component) 这类面向组件开发的工具。*

---

**用 ❤️ 为 AI-powered 的 Web 开发而生**

*现在你的 AI 能分析任何你用 `Option+Click` 指的元素了！👆*
