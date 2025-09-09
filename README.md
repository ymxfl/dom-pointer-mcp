![MCP Pointer banner](/docs/banner.png)

[![CI](https://github.com/etsd-tech/mcp-pointer/actions/workflows/ci.yml/badge.svg?branch=main&event=check_suite)](https://github.com/etsd-tech/mcp-pointer/actions/workflows/ci.yml)
[![Release](https://github.com/etsd-tech/mcp-pointer/actions/workflows/release.yml/badge.svg?event=release)](https://github.com/etsd-tech/mcp-pointer/actions/workflows/release.yml)

# 👆 MCP Pointer

**Point to browser DOM elements for agentic coding tools via MCP!**

MCP Pointer is a *local* tool combining an MCP Server with a Chrome Extension:

1. **🖥️ MCP Server** (Node.js package) - Bridges between the browser and AI tools via the Model Context Protocol
2. **🌐 Chrome Extension** - Captures DOM element selections in the browser using Option+Click

The extension lets you visually select DOM elements in the browser, and the MCP server makes this **textual context** available to agentic coding tools like Claude Code, Cursor, and Windsurf through standardized MCP tools.

## ✨ Features

- 🎯 **Option+Click Selection** - Simply hold Option (Alt on Windows) and click any element
- 📋 **Complete Element Data** - Text content, CSS classes, HTML attributes, positioning, and styling
- ⚛️ **React Component Detection** - Component names and source files via Fiber (experimental)
- 🔗 **WebSocket Connection** - Real-time communication between browser and AI tools
- 🤖 **MCP Compatible** - Works with Claude Code and other MCP-enabled AI tools

## 🎬 Example

![MCP Pointer Demo](/docs/demo.gif)

See MCP Pointer in action: Option+Click any element in your browser, then ask your AI assistant to analyze it. The AI gets complete context about the selected element including CSS properties, React source files, and more.

## 🚀 Getting Started

> **Note:** Chrome extension is not yet published on Chrome Web Store. You'll need to build and install it manually for now.

### 1. Configure the MCP Server

Use npx to automatically configure the MCP server with your AI tool:

```bash
# Configure MCP Pointer for your AI tool
npx -y @mcp-pointer/server config claude     # Automatically configures Claude Code
npx -y @mcp-pointer/server config cursor     # Opens Cursor deeplink for automatic installation
npx -y @mcp-pointer/server config windsurf   # Automatically updates Windsurf config file
npx -y @mcp-pointer/server config manual     # Shows manual configuration for other tools
```

> **Optional:** You can install globally with `npm install -g @mcp-pointer/server` to use `mcp-pointer` instead of `npx -y @mcp-pointer/server`

### 2. Install Chrome Extension

**Current method (Chrome Web Store not available yet):**

1. Download the latest release from [GitHub Releases](https://github.com/etsd-tech/mcp-pointer/releases) *(coming soon)*
2. **Or build from source:** Follow the build instructions in [CONTRIBUTING.md](./CONTRIBUTING.md)

**Load in Chrome:**
1. Open Chrome → Settings → Extensions → Developer mode (toggle ON)
2. Click "Load unpacked"
3. Select the `packages/chrome-extension/dist/` folder
4. The MCP Pointer extension should appear in your extensions list

### 3. Start Using

1. **Navigate to any webpage** 
2. **Option+Click** any element to select it
3. **Ask your AI** to analyze the targeted element!

Your AI tool will automatically start the MCP server when needed using the `npx -y @mcp-pointer/server start` command.

**Available AI Tools:**
- `getTargetedElement` - Get comprehensive info about the selected element
- `clearTargetedElement` - Clear the current selection
- `getPointerStatus` - Check system status and statistics

## 🎯 How It Works

1. **Element Selection**: Content script captures Option+Click events
2. **Data Extraction**: Analyzes element structure, CSS, and framework info
3. **WebSocket Transport**: Sends data to MCP server on port 7007
4. **MCP Protocol**: Makes data available to AI tools via MCP tools
5. **AI Analysis**: Your assistant can now see and analyze the element!

## 🎨 Element Data Extracted

- **Basic Info**: Tag name, ID, classes, text content
- **CSS Properties**: Display, position, colors, dimensions
- **Component Info**: React component names and source files (experimental)  
- **Attributes**: All HTML attributes
- **Position**: Exact coordinates and dimensions
- **Source Hints**: File paths and component origins

## 🔍 Framework Support

- ⚛️ **React** - Component names and source files via Fiber (experimental)
- 📦 **Generic HTML/CSS/JS** - Full support for any web content
- 🔮 **Planned** - Vue component detection (PRs appreciated)

## 🌐 Browser Support

- ✅ **Chrome** - Full support (tested)
- 🟡 **Chromium-based browsers** - Should work (Edge, Brave, Arc - load built extension manually)

## 🐛 Troubleshooting

### Extension Not Connecting

1. Make sure MCP server is running: `npx -y @mcp-pointer/server start`
2. Check browser console for WebSocket errors
3. Verify port 7007 is not blocked by firewall

### MCP Tools Not Available

1. Restart your AI assistant after installing
2. Check MCP configuration: `mcp-pointer config <your-tool>`  
3. Verify server is running: `npx -y @mcp-pointer/server start`

### Elements Not Highlighting

1. Some pages block content scripts (chrome://, etc.)
2. Try refreshing the page
3. Check if targeting is enabled (click extension icon)

## 🚀 Roadmap

### 1. **Dynamic Context Control**
   - LLM-configurable detail levels (visible text only, all text, CSS levels)
   - Progressive refinement options
   - Token-conscious data fetching

### 2. **Enhanced Framework Support**
   - Vue.js component detection
   - Better React support (React 19 removed `_debugSource`, affecting source mapping in dev builds)

### 3. **Visual Content Support** (for multimodal LLMs)
   - Base64 encoding for images (img tags)
   - Screenshot capture of selected elements
   - Separate MCP tool for direct visual content retrieval

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) guide for development setup and guidelines.

---

**Made with ❤️ for AI-powered web development**

*Now your AI can analyze any element you point at! 👆*