# MCP Pointer 编译产物使用指南

本文档说明 `pnpm build` 后的产物如何使用。

## 编译产物概览

执行 `pnpm install && pnpm build` 后,会在以下两个目录生成产物:

| 包 | 产物路径 | 说明 |
| --- | --- | --- |
| `@mcp-pointer/server` | `packages/server/dist/cli.cjs` | 独立的 Node CLI(已 bundle 全部依赖) |
| `@mcp-pointer/chrome-extension` | `packages/chrome-extension/dist/` | Chrome unpacked extension 目录 |

两端通过 WebSocket(默认端口 `7007`)通信,必须先启动 server,扩展才能连上。

---

## 一、Server(MCP 服务)

### 1. 直接运行

```bash
# 启动 MCP server
node packages/server/dist/cli.cjs start

# 查看可用命令
node packages/server/dist/cli.cjs --help
```

常用命令:

```bash
# 启动服务
node packages/server/dist/cli.cjs start

# 自动写入指定 AI 工具的 MCP 配置
node packages/server/dist/cli.cjs config claude
node packages/server/dist/cli.cjs config cursor
node packages/server/dist/cli.cjs config windsurf
node packages/server/dist/cli.cjs config manual
```

常用选项:

```
-l, --log-level <level>  日志级别 debug|info|warn|error(默认 info)
-s, --silent             关闭所有日志
-V, --version            打印版本
```

### 2. 全局链接为 `mcp-pointer` 命令

```bash
cd packages/server
pnpm link --global

# 之后即可直接调用
mcp-pointer start
mcp-pointer config claude
```

### 3. 在 AI 工具 MCP 配置中直接指向产物

无需全局安装,在 Claude / Cursor 等工具的 MCP 配置文件中追加:

```json
{
  "mcpServers": {
    "pointer": {
      "command": "node",
      "args": [
        "/Users/ymxfl/GithubStudy/mcp-pointer/packages/server/dist/cli.cjs",
        "start"
      ]
    }
  }
}
```

> 路径请改为你本机的绝对路径。

---

## 二、Chrome 扩展

`packages/chrome-extension/dist/` 是一个 unpacked extension 目录(包含 `manifest.json` 与编译后的 `background.js`、`content.js`、`popup.*`、图标、样式等)。

加载步骤:

1. 浏览器打开 `chrome://extensions/`
2. 右上角开启 **Developer mode(开发者模式)**
3. 点击 **Load unpacked(加载已解压的扩展程序)**
4. 选择目录:
   `/Users/ymxfl/GithubStudy/mcp-pointer/packages/chrome-extension/dist`

加载后即可在工具栏看到 MCP Pointer 图标。

---

## 三、联动使用流程

1. 启动 server:
   ```bash
   node packages/server/dist/cli.cjs start
   ```
2. 在 Chrome 中加载上面的 unpacked extension。
3. 在任意网页上通过扩展指向(point)某个 DOM 元素。
4. 在已配置 MCP 的 AI 工具(Claude/Cursor/Windsurf 等)中,通过 MCP 调用即可读取当前指向元素的信息。

---

## 四、常见问题

- **`esbuild: command not found` / 构建失败**
  先执行 `pnpm install` 安装依赖,再 `pnpm build`。
- **扩展连不上 server**
  确认 server 已启动且 `7007` 端口未被占用。
- **重新构建**
  ```bash
  pnpm build           # 全量构建
  pnpm -r --parallel run dev   # 开发模式(watch)
  ```
