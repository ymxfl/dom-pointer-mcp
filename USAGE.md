# DOM Pointer MCP 编译产物使用指南

本文档说明 `pnpm build` 后的产物如何使用。

> ⚠️ 本文件被 `.gitignore` 排除，是本地参考资料，不会随仓库一同提交。

## 编译产物概览

执行 `pnpm install && pnpm build` 后，会在以下两个目录生成产物：

| 包 | 产物路径 | 说明 |
| --- | --- | --- |
| `@dom-pointer-mcp/server` | `packages/server/dist/cli.cjs` | 独立的 Node CLI（已 bundle 全部依赖） |
| `@dom-pointer-mcp/chrome-extension` | `packages/chrome-extension/dist/` | Chrome unpacked extension 目录 |

两端通过 WebSocket（默认端口 `7007`）通信，必须先启动 server，扩展才能连上。

---

## 一、Server（MCP 服务）

### 1. 直接运行

```bash
# 启动 MCP server
node packages/server/dist/cli.cjs start

# 查看可用命令
node packages/server/dist/cli.cjs --help
```

常用命令：

```bash
# 启动服务
node packages/server/dist/cli.cjs start

# 交互式安装/卸载：会询问 action / agents / scope / slash command
node packages/server/dist/cli.cjs config

# 非交互式安装单一 agent（保留旧用法）
node packages/server/dist/cli.cjs config claude    # 也可以是 cursor / windsurf / codex / opencode / joycode
node packages/server/dist/cli.cjs config claude --scope project

# 非交互式卸载
node packages/server/dist/cli.cjs config --uninstall            # 进入交互式卸载
node packages/server/dist/cli.cjs config --uninstall claude     # 卸载单个 agent（user scope）
node packages/server/dist/cli.cjs config --uninstall claude --scope project
```

> 交互式卸载默认只清理 user scope。要清理 project scope，需要 `cd` 回原来安装的目录，再加上 `--scope project` 运行。

常用选项：

```
-l, --log-level <level>  日志级别 debug|info|warn|error（默认 info）
-s, --silent             关闭所有日志
-V, --version            打印版本
```

> 服务端日志统一走 stderr，stdout 留给 MCP 协议使用，避免与 AI 工具的 JSON-RPC 流冲突。

### 2. 全局链接为 `dom-pointer-mcp` 命令

```bash
cd packages/server
pnpm link --global

# 之后即可直接调用
dom-pointer-mcp start
dom-pointer-mcp config
```

### 3. 在 AI 工具 MCP 配置中直接指向产物

无需全局安装，在 Claude / Cursor 等工具的 MCP 配置文件中追加：

```json
{
  "mcpServers": {
    "pointer": {
      "command": "node",
      "args": [
        "/Users/lizhenhua.81/GithubStudy/dom-pointer-mcp/packages/server/dist/cli.cjs",
        "start"
      ]
    }
  }
}
```

> 路径请改为你本机的绝对路径。
> 或者使用上面的 `config` 命令让 CLI 自动写入（推荐，1.0 起所有 MCP 注册都是增量合并，不会覆盖你现有的配置）。

---

## 二、Chrome 扩展

`packages/chrome-extension/dist/` 是一个 unpacked extension 目录（包含 `manifest.json` 与编译后的 `background.js`、`content.js`、`popup.*`、`extractor-main.js`（MAIN world）、图标、样式等）。

加载步骤：

1. 浏览器打开 `chrome://extensions/`
2. 右上角开启 **Developer mode（开发者模式）**
3. 点击 **Load unpacked（加载已解压的扩展程序）**
4. 选择目录：
   `/Users/lizhenhua.81/GithubStudy/dom-pointer-mcp/packages/chrome-extension/dist`

加载后即可在工具栏看到 DOM Pointer MCP 图标。点击图标可以看到 server 可达性指示（🟢 / 🔴）、端口设置以及 Recheck 按钮。

---

## 三、联动使用流程

1. 启动 server：
   ```bash
   node packages/server/dist/cli.cjs start
   ```
2. 在 Chrome 中加载上面的 unpacked extension。
3. 在任意网页：
   - `Option+Click`（macOS）/ `Alt+Click`（Windows）选中元素，可继续点其它元素叠加为一个 batch。
   - 第一次选中后会出现浮动 note panel，输入你想让 AI 做什么。
   - **Send**（`⌘/Ctrl+Enter`）发送 `{ userNote, elements: [...] }` 到 server；**Copy** 复制同样的内容到剪贴板；**×** 关闭。
4. 在已配置 MCP 的 AI 工具（Claude/Cursor/Windsurf/Codex/Opencode/Joycode）中，调用 `get-pointed-element` 工具即可读取当前选中 batch。可选参数：
   - `textDetail`：`0|1|2`（默认 `2`），控制每个元素文本的详略。
   - `cssLevel`：`0|1|2|3`（默认 `1`），控制每个元素的 CSS 详略。

---

## 四、常见问题

- **`esbuild: command not found` / 构建失败**
  先执行 `pnpm install` 安装依赖，再 `pnpm build`。
- **扩展弹窗显示 "Server unreachable"**
  确认 server 已启动，弹窗里端口与服务端绑定端口一致；改完端口点 **Save** 会自动重新探测。
- **`get-pointed-element` 返回旧格式 / 报错**
  v0.7 起 wire format 已切换为 batch（`{ userNote, elements: [...] }`），扩展和 server 必须同版本。
- **重新构建**
  ```bash
  pnpm build           # 全量构建
  pnpm -r --parallel run dev   # 开发模式（watch）
  ```
