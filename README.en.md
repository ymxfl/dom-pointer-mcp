<img width="1440" height="480" alt="DOM Pointer MCP banner" src="https://github.com/user-attachments/assets/a36d2666-e848-4a80-97b3-466897b244f7" />

[![CI](https://github.com/ymxfl/dom-pointer-mcp/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ymxfl/dom-pointer-mcp/actions/workflows/ci.yml)
[![Release](https://github.com/ymxfl/dom-pointer-mcp/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/ymxfl/dom-pointer-mcp/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/@dom-pointer-mcp/server?label=Server)](https://www.npmjs.com/package/@dom-pointer-mcp/server)
[![Chrome Extension](https://img.shields.io/github/package-json/v/ymxfl/dom-pointer-mcp?filename=packages%2Fchrome-extension%2Fpackage.json&label=Chrome-Extension)](https://github.com/ymxfl/dom-pointer-mcp/releases)
[![License: MIT](https://img.shields.io/github/license/ymxfl/dom-pointer-mcp?label=License)](https://github.com/ymxfl/dom-pointer-mcp/blob/main/LICENSE)

**Languages**: [简体中文](./README.md) · **English**

# 👆 DOM Pointer MCP

**Select DOM elements in the browser, tell your AI what to change in plain language!**

DOM Pointer MCP is a local tool combining a Chrome Extension and an MCP Server. After setup, all you need to do is:

1. **`Option+Click` to select elements in the browser**
2. **Write a short description of what you want changed**
3. **Press Send** — the AI gets the context and modifies your source code

**No need to call MCP tools manually.** Through Skills and slash commands, AI tools automatically recognize trigger phrases like "做一下", "pointed", or "fix the selected elements" and fetch the element context. Users never need to understand the underlying MCP protocol.

## ✨ Features

- 🎯 **`Option+Click` Selection** — Simply hold `Option` (Alt on Windows) and click any element
- 🧺 **Multi-select Batches** — Stack multiple elements into one batch and send them with a shared note
- 📝 **Floating Note Panel** — Type a free-form instruction next to your selection, then Send or Copy
- 🤖 **Skill Auto-trigger** — No need to type `/pointed`; just say "做一下", "fix the selected", etc. and the AI acts automatically
- 📋 **Complete Element Data** — Text content, CSS classes, HTML attributes, positioning, and styling
- 💡 **Dynamic Context Control** — Request visible-only text, suppress text entirely, or dial CSS detail from none → full computed styles per call
- ⚛️ **Component Detection** — React (≤ 18) / Vue 2 / Vue 3 component names and source files via runtime introspection (experimental)
- 🟢 **Server Status Indicator** — The popup probes the MCP server and tells you instantly when it's not reachable
- 🛠️ **Interactive Multi-agent Config** — One `config` command installs MCP + Skill + slash command across Claude Code, Cursor, Windsurf, Codex, Opencode, JoyCode
- 🌐 **i18n Support** — Config UI supports Chinese / English (`--lang en`)

## 🎬 Usage Example (Video)

https://github.com/user-attachments/assets/98c4adf6-1f05-4c9b-be41-0416ab784e2c

`Option+Click` any element, write your change request and press Send. The AI automatically receives full context (CSS, URL, selector, component source files, etc.) and modifies the code.

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

### 2. Configure AI Tools

Run the `config` command to install the MCP server + Skill + optional slash command for your AI tools:

```bash
npx -y @dom-pointer-mcp/server config
```

You'll be walked through:

1. **Action** — Install or Uninstall
2. **Agents** — checkbox-pick any combination of: Claude Code, Cursor, Windsurf, Codex, Opencode, JoyCode
3. **Scope** — `user` (global) or `project` (current directory only)
4. **Launch mode** — `npx` (always fetch latest from registry) or `global` (use locally installed binary, works offline)
5. **Slash command?** — whether to also install the `/pointed` slash command

Each agent reports `installed` / `degraded` / `skipped` / `failed` per artifact so you can see exactly what landed where.

> **💡 Language:** The config UI defaults to Chinese. Add `--lang en` for English, e.g. `npx -y @dom-pointer-mcp/server config --lang en`.

<details>
<summary>Non-interactive (scripts, CI)</summary>

```bash
# Install a single tool
npx -y @dom-pointer-mcp/server config claude       # or cursor, windsurf, codex, opencode, joycode
npx -y @dom-pointer-mcp/server config claude --scope project

# Use globally installed binary (no registry fetch, works offline)
npx -y @dom-pointer-mcp/server config claude --scope user --global

# Uninstall
npx -y @dom-pointer-mcp/server config --uninstall            # interactive uninstall
npx -y @dom-pointer-mcp/server config --uninstall claude     # one tool
npx -y @dom-pointer-mcp/server config --uninstall claude --scope project
```

</details>

<details>
<summary>Global install mode (recommended for private registries / offline environments)</summary>

```bash
# 1. Install globally (one-time)
npm install -g @dom-pointer-mcp/server

# 2. Configure with global mode
dom-pointer-mcp config --global
# or non-interactive
dom-pointer-mcp config claude --scope user --global
```

To upgrade:
```bash
npm update -g @dom-pointer-mcp/server
```

</details>

After configuration, **restart your coding tool** to load the configuration.

### 3. Start Using

After setup, there are **three ways to use** DOM Pointer MCP (the first two are recommended — no MCP knowledge needed):

#### Option A: Skill Auto-trigger (Recommended)

A `pointed` Skill is automatically registered during installation:
1. `Option+Click` elements in the browser, write your note and press Send
2. In your AI tool, just say "**做一下**", "**pointed**", "**fix the selected elements**", etc.
3. The AI automatically calls MCP, reads your selection, and modifies the code

> The advantage of Skills is that you don't need to remember any commands — natural language is all it takes.

#### Option B: `/pointed` Slash Command

If you chose to install the slash command during config:
1. `Option+Click` elements in the browser, write your note and press Send
2. Type `/pointed` in your AI tool
3. The AI fetches your selection and acts on it

Supports appending parameters to control context detail: `/pointed 0 0` (numbers map to textDetail and cssLevel)

#### Option B′: `/pointed get` — Preview Without Acting

If you just want to inspect the selection without the AI making changes:

```
/pointed get          # defaults: textDetail=2, cssLevel=0
/pointed get 2 2      # textDetail=2, cssLevel=2
/pointed get 1 3      # textDetail=1, cssLevel=3
```

The AI returns a structured summary (URL, element count, tag / selector / component name per element), then:
- If a note was written in the browser → asks "Execute the note?"
- If no note → asks "What would you like to do with these elements?"

Great for previewing what you selected before committing to an action.

#### Option C: Direct MCP Tool Call

Advanced users can also ask the AI to call `get-pointed-element` directly:
- `textDetail`: `0` (no text) | `1` (visible text only) | `2` (visible + hidden, default)
- `cssLevel`: `0` (no CSS) | `1` (layout, default) | `2` (+ box model) | `3` (full computed style)

## 🎯 How It Works

1. **Hold Option (Alt) and click** any element on the page — it becomes selected (highlighted)
2. *(Optional)* Hold Option and click more elements — multi-select adds them to a batch
3. A floating **note panel** appears next to the first selected element with a textarea and three buttons
4. Type a description of what you want changed (e.g. "make these buttons primary blue", "add a divider between [1] and [2]")
5. **Send** (⌘/Ctrl+Enter) ships the selection + your note to the MCP server; **Copy** puts the same payload on your clipboard; **×** dismisses the panel
6. Trigger in your AI tool (say "做一下" or type `/pointed`) — the AI receives `{ userNote, url, timestamp, elements: [...] }` and acts

To cancel a selected element, Option+Click it again or click the × on its chip. The note panel stays visible until **all** selections are cancelled — your typed text is never lost from incidental clicks.

The extension popup probes the configured server on open and shows a 🟢 / 🔴 status indicator, so you find out the server is down *before* you click Send.

## 🎨 Element Data Extracted

- **User Note** — A shared description typed by the user about the whole batch
- **Basic Info** — Tag name, ID, classes, text content (per element)
- **CSS Properties** — Display, position, colors, dimensions (per element, controlled by cssLevel)
- **Component Info** — React / Vue component names and source files (experimental)
- **Attributes** — All HTML attributes
- **Position** — Exact coordinates and dimensions
- **Source Hints** — File paths and component origins

## 🔍 Framework Support

- ⚛️ **React ≤ 18** — Component names and source files via Fiber (experimental). The extractor walks `fiber.return` so wrapper-DOM clicks still resolve to the nearest component ancestor. React 19 removed `_debugSource` and is not yet supported.
- 🟢 **Vue 2 / Vue 3** — Component names and source files via runtime instance (experimental; Vue gives filename only, no line numbers).
- 📦 **Generic HTML/CSS/JS** — Full support for any web content

Component extraction runs in the page's MAIN world (so it can read React Fiber / Vue internals) and is bridged to the extension's ISOLATED world via a small request/response protocol.

## 🌐 Browser Support

- ✅ **Chrome** — Full support (tested)
- 🟡 **Chromium-based browsers** — Should work (Edge, Brave, Arc — load built extension manually)

## 🐛 Troubleshooting

### Extension Not Connecting

1. Make sure MCP server is running: `npx -y @dom-pointer-mcp/server@latest start`
2. Check browser console for WebSocket errors
3. Verify port 7007 is not blocked by firewall

### MCP Tools Not Available

1. Restart your AI assistant after installing
2. Re-run `npx -y @dom-pointer-mcp/server config` and confirm your tool shows `installed` for MCP and Skill
3. Verify server is running: `npx -y @dom-pointer-mcp/server@latest start`

### Popup Says "Server unreachable"

1. The popup probes the port shown in its input — confirm it matches the port your server is bound to (default `7007`)
2. Click **Recheck** after starting the server
3. If you changed the port, click **Save** to persist it; the probe re-runs automatically

### Elements Not Highlighting

1. Some pages block content scripts (chrome://, etc.)
2. Try refreshing the page
3. Check if targeting is enabled (click extension icon)

## 🚀 Roadmap

### 1. **Visual Content Support** (for multimodal LLMs)
   - Base64 encoding for images (img tags)
   - Screenshot capture of selected elements
   - Separate MCP tool for direct visual content retrieval

### 2. **Enhanced Framework Support**
   - React 19+ support (React 19 removed `_debugSource`; currently only React 18 and below are supported)
   - Svelte / Solid component detection

### 3. **More AI Tool Integrations**
   - Follow emerging MCP-compatible AI tools
   - Explore non-MCP integration pathways

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
