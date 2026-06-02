<img width="1774" height="887" alt="DOM-Pointer-MCP banner" src="https://github.com/user-attachments/assets/e948b838-7ee5-4a24-90d7-a2b733d82f75" />

[![CI](https://github.com/ymxfl/dom-pointer-mcp/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ymxfl/dom-pointer-mcp/actions/workflows/ci.yml)
[![Release](https://github.com/ymxfl/dom-pointer-mcp/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/ymxfl/dom-pointer-mcp/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/@dom-pointer-mcp/server?label=Server)](https://www.npmjs.com/package/@dom-pointer-mcp/server)
[![Chrome Extension](https://img.shields.io/github/package-json/v/ymxfl/dom-pointer-mcp?filename=packages%2Fchrome-extension%2Fpackage.json&label=Chrome-Extension)](https://github.com/ymxfl/dom-pointer-mcp/releases)
[![License: MIT](https://img.shields.io/github/license/ymxfl/dom-pointer-mcp?label=License)](https://github.com/ymxfl/dom-pointer-mcp/blob/main/LICENSE)

**Languages**: **简体中文** · [English](./README.en.md)

# 👆 DOM Pointer MCP

**在浏览器里圈选 DOM 元素，用自然语言让 AI 编码工具直接改代码！**

DOM Pointer MCP 是一个本地工具，由 Chrome 扩展 + MCP Server 组成。安装完成后你只需要：

1. **在浏览器中 `Option+Click` 选择元素**
2. **写一句话描述你想要的改动**
3. **按 Send**——AI 自动拿到上下文并修改源码

**无需手动调用 MCP 工具。** 通过 `/pointed` 命令（Skill 或 slash command），AI 自动获取选中的元素上下文并执行你写的 note，用户完全不需要了解底层 MCP 协议。

## ✨ 特性

- 🎯 **`Option+Click` 选择** —— 按住 `Option`（Windows 上是 `Alt`）点击任意元素
- 🧺 **多选 Batch** —— 多个元素叠加成一个 batch，配一段共享的 note 一起发送
- 📝 **浮动 Note Panel** —— 在选中区域旁边写自由文本说明，可 Send 或 Copy
- 🤖 **Skill / Slash command** —— 输入 `/pointed` 即可触发，AI 自动获取选区并执行
- 📋 **完整元素数据** —— 文本内容、CSS 类、HTML 属性、定位、样式等
- 💡 **按需控制上下文体量** —— 每次调用可选只要可见文本、不要文本、CSS 详略 0–3
- ⚛️ **组件信息识别** —— 通过运行时反射拿到 React（≤ 18）/ Vue 2 / Vue 3 的组件名和源文件（实验性）
- 🟢 **服务端状态指示** —— 弹窗会探测 MCP server，发不出去之前你就能看到红灯
- 🛠️ **交互式多 Agent 配置** —— 一条 `config` 命令为 Claude Code、Cursor、Windsurf、Codex、Opencode、JoyCode 安装 MCP + Skill + slash命令
- 🌐 **i18n 支持** —— 配置界面支持中文 / 英文（`--lang en`）

## 🎬 使用示例（视频）



https://github.com/user-attachments/assets/26816d01-0e15-4a31-86ff-c41519b98e63



`Option+Click` 任意元素，写下你的改动需求按 Send，AI 自动拿到选中元素的完整上下文（CSS、URL、selector、组件源文件等）并修改代码。

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

### 2. 配置 AI 工具

运行 `config` 命令，一键为你的 AI 工具安装 MCP server + Skill + 可选的slash命令：

```bash
npx -y @dom-pointer-mcp/server config
```

会依次问你：

1. **Action** —— Install 还是 Uninstall
2. **Agents** —— 多选：Claude Code、Cursor、Windsurf、Codex、Opencode、JoyCode
3. **Scope** —— `user`（全局）或 `project`（仅当前目录）
4. **启动方式** —— `npx`（每次从 registry 获取最新）或 `global`（使用本地已安装的 bin，离线可用）
5. **Slash command?** —— 是否同时安装 `/pointed` slash命令

每个 agent 会按 `installed` / `degraded` / `skipped` / `failed` 分项报告结果。

> **💡 切换为英文界面：** 加 `--lang en` 即可，如 `npx -y @dom-pointer-mcp/server config --lang en`。

<details>
<summary>非交互式（脚本 / CI）</summary>

```bash
# 安装单个 agent
npx -y @dom-pointer-mcp/server config claude       # 也支持 cursor / windsurf / codex / opencode / joycode
npx -y @dom-pointer-mcp/server config claude --scope project

# 使用全局安装的 bin（不走 npx fetch，离线可用）
npx -y @dom-pointer-mcp/server config claude --scope user --global

# 卸载
npx -y @dom-pointer-mcp/server config --uninstall            # 交互式卸载
npx -y @dom-pointer-mcp/server config --uninstall claude     # 单个 agent
npx -y @dom-pointer-mcp/server config --uninstall claude --scope project
```

</details>

<details>
<summary>全局安装模式（推荐私服 / 离线环境）</summary>

```bash
# 1. 全局安装（仅需一次）
npm install -g @dom-pointer-mcp/server

# 2. 配置时选择 global 模式
dom-pointer-mcp config --global
# 或非交互式
dom-pointer-mcp config claude --scope user --global
```

升级时只需：
```bash
npm update -g @dom-pointer-mcp/server
```

</details>

配置完成后，**重启 AI 工具** 让配置生效。

### 3. 开始使用

配置完成后有 **两种使用方式**（推荐第一种——无需了解 MCP）：

#### 方式一：`/pointed` 命令（推荐）

Skill 和 slash command 均以 `/pointed` 触发，行为一致：

1. 在浏览器中 `Option+Click` 选择元素，写好 note 按 Send
2. 在 AI 工具中输入 `/pointed`（或触发 `pointed` skill）
3. AI 自动调用 MCP 获取选区：
   - **有 note** → 直接执行你写的改动，不会再问确认
   - **没有 note** → 询问 "你想对这些元素做什么？"

支持追加参数控制上下文详略：`/pointed 0 0`（数字分别对应 textDetail 和 cssLevel，省略则使用服务端默认值）

##### `/pointed get` —— 只看不改

如果你只想预览选区信息、不需要 AI 立即动手改代码：

```
/pointed get          # 使用服务端默认参数
/pointed get 2 2      # textDetail=2, cssLevel=2
/pointed get 1 3      # textDetail=1, cssLevel=3
```

AI 会返回选区的结构化摘要（URL、元素数量、每个元素的 tag / selector / 组件名等），然后：
- 如果浏览器里写了 note → 提示"是否执行？"，**等你确认后才会改代码**
- 如果没写 note → 提示"你想对这些元素做什么？"

适合你想先看看选到了什么，再决定下一步操作的场景。

#### 方式二：直接调用 MCP 工具

高级用户也可以直接要求 AI 调用 `get-pointed-element` 工具（省略参数则使用服务端默认值）：
- `textDetail`：`0`（不含文本）| `1`（仅可见文本）| `2`（可见 + 隐藏，默认）
- `cssLevel`：`0`（无 CSS）| `1`（布局，默认）| `2`（+ 盒模型）| `3`（完整 computed style）

## 🎯 工作流程

1. **按住 Option (Alt) 点击** 页面元素 —— 元素被选中并高亮
2. *（可选）* 继续按住 Option 点更多元素 —— 多选叠加成一个 batch
3. 第一个选中的元素旁会出现 **浮动 note panel**，里面有 textarea 和三个按钮
4. 写下你想要的改动（例如 "把这些按钮改成蓝色"、"在 [1] 和 [2] 之间加分割线"）
5. **Send**（`⌘/Ctrl+Enter`）把选区 + note 发到 MCP server；**Copy** 把同样的内容拷到剪贴板；**×** 关闭面板
6. 在 AI 工具中输入 `/pointed`，AI 拿到 `{ userNote, url, timestamp, elements: [...] }` 并执行

要取消某个选中：再次 Option+Click 该元素，或者点 chip 上的 ×。Note panel 会一直保留，直到 **所有** 选中都被取消——防止你正在写的文本被误点丢掉。

打开扩展弹窗时会自动探测已配置的 server 并显示 🟢 / 🔴 状态指示，让你在按 Send 之前就知道 server 还在不在。

## 🎨 提取的元素数据

- **User Note** —— 用户为整个 batch 写的描述
- **Basic Info** —— tag name、id、class、文本内容（逐元素）
- **CSS Properties** —— display、position、颜色、尺寸（逐元素，按 cssLevel 控制详略）
- **Component Info** —— React / Vue 组件名和源文件（实验性）
- **Attributes** —— 所有 HTML 属性
- **Position** —— 精确的坐标和尺寸
- **Source Hints** —— 源文件路径和组件来源

## 🔍 框架支持

- ⚛️ **React ≤ 18** —— 通过 Fiber 获取组件名和源文件（实验性）。提取器会向上走 `fiber.return`，所以即便你点中的是包装 DOM，也能解析到最近的组件祖先。React 19 移除了 `_debugSource`，暂不支持。
- 🟢 **Vue 2 / Vue 3** —— 通过运行时实例获取组件名和源文件（实验性；Vue 只给文件名，没有行号）。
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
2. 再跑一次 `npx -y @dom-pointer-mcp/server config`，确认你的工具同时显示 MCP 和 Skill 为 `installed`
3. 确认 server 在跑：`npx -y @dom-pointer-mcp/server@latest start`

### 弹窗显示 "Server unreachable"

1. 弹窗探测的端口就是输入框里那个——确认和 server 实际绑定端口一致（默认 `7007`）
2. 启动 server 后点 **Recheck** 重试
3. 如果改了端口，点 **Save** 保存，会自动重新探测

### 元素不高亮

1. 某些页面会屏蔽 content script（`chrome://` 等）
2. 试着刷新页面
3. 通过扩展图标确认 targeting 是开着的

## 🚀 Roadmap

### 1. **Visual Content Support**（面向多模态 LLM）
   - 图片（img tag）转 base64
   - 选中元素截图
   - 提供独立的视觉内容 MCP 工具

### 2. **更好的框架支持**
   - React 19+ 支持（React 19 移除了 `_debugSource`，当前仅支持 React 18 及以下）
   - Svelte / Solid 组件识别

### 3. **更多 AI 工具支持**
   - 跟进新出现的 MCP-compatible AI 工具
   - 探索非 MCP 协议的集成方式
## 💰 感谢打赏

<img width="223" height="304" alt="微信收款码" src="https://github.com/user-attachments/assets/42927b8f-7f05-4d32-a509-d2f2494a2e9d" /><img width="216" height="323" alt="支付宝收款码" src="https://github.com/user-attachments/assets/e5153e4d-3c19-4a76-b9f0-b8e9e6d65ef2" />
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
