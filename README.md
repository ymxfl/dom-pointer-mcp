![MCP Pointer banner](/docs/banner.png)

# 👆 MCP Pointer

**Point to browser DOM elements for agentic coding tools via MCP!**

MCP Pointer is a *local* tool combining a Chrome extension with an MCP server. The extension lets you visually select DOM elements in the browser, and the MCP server makes this **textual context** available through the Model Context Protocol. Agentic coding tools like Claude Code, Cursor, Windsurf, or Continue can then access that information directly, enabling smoother interaction between the web and your AI-powered coding environment.

## ✨ Features

- 🎯 **Option+Click Selection** - Simply hold Option (Alt on Windows) and click any element
- 📋 **Complete Element Data** - Text content, CSS classes, HTML attributes, positioning, and styling
- ⚛️ **React Component Detection** - Component names and source files via Fiber (experimental)
- 🔗 **WebSocket Connection** - Real-time communication between browser and AI tools
- 🤖 **MCP Compatible** - Works with Claude Code and other MCP-enabled AI tools

## 🚀 Quick Start

> **Note:** Chrome extension is not yet published on Chrome Web Store. You'll need to build and install it manually for now.
> **For Contributors:** See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and contribution guidelines.

### 1. Install the MCP Server

**Option A: From npm (when published):**
```bash
# Install globally via npm
npm install -g @mcp-pointer/server
```

**Option B: Build from source (current method):**
```bash
# Clone and build the repository
git clone https://github.com/etsd-tech/mcp-pointer
cd mcp-pointer
pnpm install

# Build and link the MCP server globally  
pnpm -C packages/server link:global
```

### 2. Configure with Claude Code

```bash
# Configure MCP Pointer user-wide
claude mcp add pointer -s user --env MCP_POINTER_PORT=7007 -- mcp-pointer start
```

### 3. Install Chrome Extension

**Current method (Chrome Web Store not available yet):**

```bash
# Build the Chrome extension (if not done in step 1)
pnpm -C packages/chrome-extension build
```

**Load in Chrome:**
1. Open Chrome → Settings → Extensions → Developer mode (toggle ON)
2. Click "Load unpacked"
3. Select the `packages/chrome-extension/dist/` folder
4. The MCP Pointer extension should appear in your extensions list

### 4. Start Using

1. **Navigate to any webpage** 
2. **Option+Click** any element to select it
3. **Ask your AI** to analyze the targeted element!

Claude Code will automatically start the MCP server when needed.

## 📋 Available Commands

### MCP Server Commands

```bash
mcp-pointer start         # 👆 Start pointing at elements (start server)
mcp-pointer configure     # Show Claude MCP configuration command
mcp-pointer show-config   # Show manual configuration
```

### AI Assistant Tools

Once configured, your AI assistant will have these tools:

- `getTargetedElement` - Get comprehensive info about the selected element
- `clearTargetedElement` - Clear the current selection
- `getPointerStatus` - Check system status and statistics




## 🔧 Configuration

### Recommended Configuration

```bash
# User-wide configuration (recommended)
claude mcp add pointer -s user --env MCP_POINTER_PORT=7007 -- mcp-pointer start

# Project-specific configuration  
claude mcp add pointer --env MCP_POINTER_PORT=7007 -- mcp-pointer start
```

### Manual Configuration

For non-Claude MCP tools, add to your AI tool's MCP settings (e.g., `~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "@mcp-pointer/server": {
      "command": "mcp-pointer",
      "args": ["start"],
      "env": {
        "MCP_POINTER_PORT": "7007"
      }
    }
  }
}
```

Get this configuration by running:
```bash
mcp-pointer show-config
```

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

1. Make sure MCP server is running: `mcp-pointer start`
2. Check browser console for WebSocket errors
3. Verify port 7007 is not blocked by firewall

### MCP Tools Not Available

1. Restart your AI assistant after installing
2. Check MCP configuration: `mcp-pointer show-config`  
3. Verify server is running: `mcp-pointer start`

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