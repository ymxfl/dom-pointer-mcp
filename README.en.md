<img width="1440" height="480" alt="DOM Pointer MCP banner" src="https://github.com/user-attachments/assets/a36d2666-e848-4a80-97b3-466897b244f7" />

[![CI](https://github.com/ymxfl/dom-pointer-mcp/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ymxfl/dom-pointer-mcp/actions/workflows/ci.yml)
[![Release](https://github.com/ymxfl/dom-pointer-mcp/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/ymxfl/dom-pointer-mcp/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/@dom-pointer-mcp/server?label=Server)](https://www.npmjs.com/package/@dom-pointer-mcp/server)
[![Chrome Extension](https://img.shields.io/github/package-json/v/ymxfl/dom-pointer-mcp?filename=packages%2Fchrome-extension%2Fpackage.json&label=Chrome-Extension)](https://github.com/ymxfl/dom-pointer-mcp/releases)
[![License: MIT](https://img.shields.io/github/license/ymxfl/dom-pointer-mcp?label=License)](https://github.com/ymxfl/dom-pointer-mcp/blob/main/LICENSE)

**Languages**: [简体中文](./README.md) · **English**

# 👆 DOM Pointer MCP

**Point to browser DOM elements for agentic coding tools via MCP!**

DOM Pointer MCP is a *local* tool combining an MCP Server with a Chrome Extension:

1. **🖥️ MCP Server** (Node.js package) - Bridges between the browser and AI tools via the Model Context Protocol
2. **🌐 Chrome Extension** - Captures DOM element selections in the browser using `Option+Click`

The extension lets you visually select DOM elements in the browser, and the MCP server makes this **textual context** available to agentic coding tools like Claude Code, Cursor, and Windsurf through standardized MCP tools.

## ✨ Features

- 🎯 **`Option+Click` Selection** - Simply hold `Option` (Alt on Windows) and click any element
- 🧺 **Multi-select Batches** - Stack multiple elements into one batch and send them with a shared note
- 📝 **Floating Note Panel** - Type a free-form instruction next to your selection, then Send or Copy
- 📋 **Complete Element Data** - Text content, CSS classes, HTML attributes, positioning, and styling
- 💡 **Dynamic Context Control** - Request visible-only text, suppress text entirely, or dial CSS detail from none → full computed styles per MCP call
- ⚛️ **Component Detection** - React / Vue 2 / Vue 3 component names and source files via runtime introspection (experimental)
- 🟢 **Server Status Indicator** - The popup probes the MCP server and tells you instantly when it's not reachable
- 🛠️ **Interactive Multi-agent Config** - One `config` command installs/uninstalls MCP + slash command + skill across Claude Code, Cursor, Windsurf, Codex, Opencode, JoyCode
- 🔗 **WebSocket Connection** - Real-time communication between browser and AI tools
- 🤖 **MCP Compatible** - Works with Claude Code and other MCP-enabled AI tools

## 🎬 Usage example (video)

https://github.com/user-attachments/assets/98c4adf6-1f05-4c9b-be41-0416ab784e2c

See DOM Pointer MCP in action: `Option+Click` any element in your browser, then ask your agentic coding tool about it (in this example, Claude Code). The AI gets complete textual context about the selected DOM element including CSS properties, url, selector, and more.

## 🚀 Getting Started

### 1. Install Chrome Extension

Download and install from the latest GitHub Release:

1. Download [`dom-pointer-mcp-chrome-extension.zip`](https://github.com/ymxfl/dom-pointer-mcp/releases/latest/download/dom-pointer-mcp-chrome-extension.zip) from the [latest release](https://github.com/ymxfl/dom-pointer-mcp/releases/latest)
2. Extract the zip file to a folder on your computer
3. Open Chrome → Settings → Extensions → Developer mode (toggle ON)
4. Click "Load unpacked" and select the extracted folder
5. The DOM Pointer MCP extension should appear in your extensions list
6. **Reload web pages** to activate the extension

> **⚠️ Version Compatibility:** The Chrome extension and the MCP server are released in lockstep. When upgrading, please update both to the same version to avoid wire-format mismatches.

<details>
<summary>Build from source instead</summary>

1. Clone this repository
2. Follow the build instructions in [CONTRIBUTING.md](./CONTRIBUTING.md)
3. Open Chrome → Settings → Extensions → Developer mode (toggle ON)
4. Click "Load unpacked" and select the `packages/chrome-extension/dist/` folder
5. **Reload web pages** to activate the extension

</details>

### 2. Configure MCP Server

The `config` command installs the MCP server entry, an optional `/pointed` slash command, and (where supported) a skill, into one or more AI tools at once.

**Interactive (recommended):**

```bash
npx -y @dom-pointer-mcp/server config
```

You'll be walked through:

1. **Action** — Install or Uninstall.
2. **Agents** — checkbox-pick any combination of: Claude Code, Cursor, Windsurf, Codex, Opencode, JoyCode.
3. **Scope** — `user` (global) or `project` (current directory only).
4. **Launch mode** — `npx` (always fetch latest from registry) or `global` (use locally installed binary, works offline).
5. **Slash command?** — single y/N applied to all selected agents.

Each agent reports `installed` / `degraded` / `skipped` / `failed` per artifact so you can see exactly what landed where.

> **💡 Language:** The config UI defaults to Chinese. Add `--lang en` for English, e.g. `npx -y @dom-pointer-mcp/server config --lang en`.

<details>
<summary>Non-interactive (scripts, CI)</summary>

```bash
# Install a single tool (legacy form, still supported)
npx -y @dom-pointer-mcp/server config claude       # or cursor, windsurf, codex, opencode, joycode
npx -y @dom-pointer-mcp/server config claude --scope project

# Use globally installed binary (no registry fetch, works offline)
npx -y @dom-pointer-mcp/server config claude --scope user --global

# Uninstall (symmetric — removes MCP entry, skill, and slash command)
npx -y @dom-pointer-mcp/server config --uninstall            # interactive uninstall
npx -y @dom-pointer-mcp/server config --uninstall claude     # one tool, user scope
npx -y @dom-pointer-mcp/server config --uninstall claude --scope project
```

> Project-scope installs live in the cwd they were installed from; uninstall them by `cd`-ing back to that directory and running the project-scope uninstall. The interactive uninstall flow only touches user scope on purpose.

</details>

<details>
<summary>Global install mode (recommended for private registries / offline environments)</summary>

If your network cannot reliably reach the npm registry (e.g. corporate mirror sync lag), install globally first and use `--global` mode:

```bash
# 1. Install globally (one-time)
npm install -g @dom-pointer-mcp/server

# 2. Configure with global mode
dom-pointer-mcp config --global
# or non-interactive
dom-pointer-mcp config claude --scope user --global
```

This way, the AI tool launches the MCP server via the locally installed `dom-pointer-mcp` binary — no registry fetch on every start.

To upgrade:
```bash
npm update -g @dom-pointer-mcp/server
```

</details>

After configuration, **restart your coding tool** to load the MCP connection.

> **🔄 Already using DOM Pointer MCP?** Re-run the config command to upgrade to the new incremental MCP registration (v1.0+); your existing `~/.mcp.json` / other agents' configs are merged in place rather than overwritten.

### 3. Start Using

1. **Navigate to any webpage** 
2. **`Option+Click`** any element to select it
3. **Ask your AI** to analyze the targeted element!

Your AI tool will automatically start the MCP server when needed using the `npx -y @dom-pointer-mcp/server@latest start` command.

**Available MCP Tool:**
- `get-pointed-element` – Returns the current selection batch: `{ userNote, url, timestamp, elements: [...] }`. Optional arguments:
  - `textDetail`: `0 | 1 | 2` (default `2`) controls how much text to include per element (`0 = none`, `1 = visible text only`, `2 = visible + hidden`).
  - `cssLevel`: `0 | 1 | 2 | 3` (default `1`) controls styling detail per element, from no CSS (0) up to full computed styles (3).

## 🎯 How It Works

1. **Hold Option (Alt) and click** any element on the page — it becomes selected (highlighted).
2. *(Optional)* Hold Option and click more elements — multi-select adds them to a batch.
3. A floating **note panel** appears next to the first selected element with a textarea and three buttons.
4. Type a description of what you want changed (e.g. "make these buttons primary blue", "in [1] and [2] add a divider").
5. **Send** (⌘/Ctrl+Enter) ships the selection + your note to the MCP server; **Copy** puts the same payload on your clipboard; **×** dismisses the panel.
6. Your AI agent calls `get-pointed-element` and receives `{ userNote, url, timestamp, elements: [...] }`.

To cancel a selected element, Option+Click it again or click the × on its chip. The note panel stays visible until **all** selections are cancelled — your typed text is never lost from incidental clicks.

The extension popup probes the configured server on open and shows a 🟢 / 🔴 status indicator, so you find out the server is down *before* you click Send.

> **⚠️ Breaking change in v0.7:** The wire format changed from single-element to batched selection (`{ userNote, elements }`). The Chrome extension and the MCP server must be the **same version**. Agent prompts that consumed the old `get-pointed-element` single-object format need to be updated to handle the new batch structure.

## 🎨 Element Data Extracted

- **User Note**: A shared description typed by the user about the whole batch
- **Basic Info**: Tag name, ID, classes, text content (per element)
- **CSS Properties**: Display, position, colors, dimensions (per element)
- **Component Info**: React / Vue component names and source files (experimental)
- **Attributes**: All HTML attributes
- **Position**: Exact coordinates and dimensions
- **Source Hints**: File paths and component origins

## 🔍 Framework Support

- ⚛️ **React** - Component names and source files via Fiber (experimental). The extractor walks `fiber.return` so wrapper-DOM clicks still resolve to the nearest component ancestor.
- 🟢 **Vue 2 / Vue 3** - Component names and source files via runtime instance (experimental; Vue gives filename only, no line numbers). Same-version constraint: the page's Vue major version must match what the extractor expects.
- 📦 **Generic HTML/CSS/JS** - Full support for any web content

Component extraction runs in the page's MAIN world (so it can read React Fiber / Vue internals) and is bridged to the extension's ISOLATED world via a small request/response protocol.

## 🌐 Browser Support

- ✅ **Chrome** - Full support (tested)
- 🟡 **Chromium-based browsers** - Should work (Edge, Brave, Arc - load built extension manually)

## 🐛 Troubleshooting

### Extension Not Connecting

1. Make sure MCP server is running: `npx -y @dom-pointer-mcp/server@latest start`
2. Check browser console for WebSocket errors
3. Verify port 7007 is not blocked by firewall

### MCP Tools Not Available

1. Restart your AI assistant after installing
2. Re-run `npx -y @dom-pointer-mcp/server config` and confirm your tool shows `installed` for both MCP and (optionally) the slash command
3. Verify server is running: `npx -y @dom-pointer-mcp/server@latest start`

### Popup Says "Server unreachable"

1. The popup probes the port shown in its input — confirm it matches the port your server is bound to (default `7007`).
2. Click **Recheck** after starting the server.
3. If you changed the port, click **Save** to persist it; the probe re-runs automatically.

### Elements Not Highlighting

1. Some pages block content scripts (chrome://, etc.)
2. Try refreshing the page
3. Check if targeting is enabled (click extension icon)

## 🚀 Roadmap

### 1. **Dynamic Context Control**
   - Full raw context transferred to server
   - LLM-configurable detail levels (visible text only, all text, CSS levels)
   - Progressive refinement options / token-conscious data fetching

### 2. **Visual Content Support** (for multimodal LLMs)
   - Base64 encoding for images (img tags)
   - Screenshot capture of selected elements
   - Separate MCP tool for direct visual content retrieval

### 3. **Enhanced Framework Support**
   - Better React support (React 19 removed `_debugSource`, affecting source mapping in dev builds)
   - Svelte / Solid component detection

### 4. **Multi Select**
   - Having the ability to select multiple DOM elements
   - https://github.com/ymxfl/dom-pointer-mcp/pull/9

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) guide for development setup and guidelines.

---

## 🙏 Credits

DOM Pointer MCP is a fork of [MCP Pointer](https://github.com/etsd-tech/mcp-pointer) by [Elie](https://github.com/Eliethesaiyan). Huge thanks to the original author — this project would not exist without their work.

---

*Inspired by tools like [Click-to-Component](https://github.com/ericclemmons/click-to-component) for component development workflows.*

---

**Made with ❤️ for AI-powered web development**

*Now your AI can analyze any element you point at with `Option+Click`! 👆*
