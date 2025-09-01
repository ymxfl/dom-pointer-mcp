# 👆 MCP Pointer

**Point at DOM elements for AI analysis!**

MCP Pointer is a Chrome extension + MCP server that allows you to point at any DOM element on a webpage and have your AI assistant analyze it, understand its structure, and help you modify it.

## ✨ Features

- 🎯 **Option+Click Selection** - Simply hold Option (Alt on Windows) and click any element
- 🔍 **Smart Element Analysis** - Extracts CSS selectors, component info, and source file hints  
- ⚛️ **Framework Detection** - Recognizes React, Vue, Angular components automatically
- 🔗 **WebSocket Connection** - Real-time communication between browser and AI tools
- 🎨 **Visual Feedback** - Beautiful highlighting and connection status
- 🤖 **MCP Compatible** - Works with Claude Code and other MCP-enabled AI tools

## 🚀 Quick Start

> **For Testers & Contributors:** See [SETUP_FOR_TESTERS.md](./SETUP_FOR_TESTERS.md) for development setup instructions.

### 1. Install the MCP Server

```bash
# Install globally via npm
npm install -g @mcp-pointer/server

# Or use npx (no installation needed)
npx @mcp-pointer/server start
```

### 2. Install Chrome Extension

**For end users** (when available):
- Install from Chrome Web Store (coming soon)

**For developers** or **testing**:
1. Download or clone this repository
2. Build the extension: 
   ```bash
   cd packages/chrome-extension
   pnpm build  # Production build
   ```
3. Open Chrome → Extensions → Developer mode → Load Unpacked
4. Select `packages/chrome-extension/dist/` folder

### 3. Start Using

1. **Start the server**: `mcp-pointer start`
2. **Navigate to any webpage** 
3. **Option+Click** any element to select it
4. **Ask your AI** to analyze the targeted element!

## 📋 Available Commands

### MCP Server Commands

```bash
mcp-pointer start         # 👆 Start pointing at elements (start server)
mcp-pointer configure         # Auto-configure AI tools  
mcp-pointer show-config   # Show manual configuration
```

### AI Assistant Tools

Once configured, your AI assistant will have these tools:

- `getTargetedElement` - Get comprehensive info about the selected element
- `clearTargetedElement` - Clear the current selection
- `getPointerStatus` - Check system status and statistics

## 📦 Publishing & Build Process

This project uses automated publishing via GitHub Actions with cryptographic provenance for security and transparency.

### Build System
- **Package Manager**: pnpm with workspaces
- **Build Tool**: esbuild for fast TypeScript compilation
- **CLI Distribution**: Single bundled `.cjs` file for standalone execution
- **Dependencies**: All external packages bundled for zero-dependency installation

### Publishing Workflow
1. **Automated CI**: Every push/PR runs linting, type checking, and builds
2. **GitHub Releases**: Create a release to trigger automatic npm publishing
3. **Provenance**: Cryptographically links published package to source code
4. **Transparency**: Users can verify the published CLI matches the open source code

```bash
# Create a release to publish
git tag v0.1.0
git push origin v0.1.0
# Or use GitHub's release UI
```

## 🛠 Development Setup

```bash
# Clone repository
git clone https://github.com/elieteyssedou/mcp-pointer.git
cd mcp-pointer

# Install dependencies
pnpm install
```

### Chrome Extension Development

1. **Build extension in development mode**:
   ```bash
   cd packages/chrome-extension
   pnpm dev  # Builds to dev/ directory with logging enabled and source maps
   ```

2. **Load extension in Chrome**:
   - Open Chrome → Extensions → Developer mode → Load unpacked
   - Select `packages/chrome-extension/dev/` folder
   - The extension will appear in your browser

3. **Making changes**:
   - Files are watched automatically in dev mode
   - Refresh the extension in Chrome Extensions page after changes
   - Check browser console for development logs

4. **Development vs Production**:
   - **Dev build** (`pnpm dev`) → `dev/` folder, includes logging and source maps
   - **Production build** (`pnpm build`) → `dist/` folder, minified, no logs

### MCP Server Development

1. **Run MCP server in watch mode**:
   ```bash
   cd packages/server
   pnpm dev  # Starts server and restarts on file changes
   ```

2. **Test server locally**:
   ```bash
   # In a separate terminal
   node dist/cli.cjs --help  # Test the built CLI
   ```

3. **Configure for development**:
   ```bash
   pnpm -C packages/server configure  # Auto-configure Claude Code
   ```

### Development Commands

```bash
# Build everything for production
pnpm build

# Run linting and type checking
pnpm lint
pnpm typecheck

# Clean all build outputs
pnpm -C packages/chrome-extension clean
pnpm -C packages/server clean
```

## 🏗 Project Structure

```
packages/
├── server/              # @mcp-pointer/server - MCP Server (TypeScript)
│   ├── src/
│   │   ├── start.ts      # Main server entry point
│   │   ├── cli.ts        # Command line interface  
│   │   ├── websocket-server.ts
│   │   └── mcp-handler.ts
│   ├── dist/
│   │   └── cli.cjs       # Bundled standalone CLI
│   └── package.json
│
├── chrome-extension/    # Chrome Extension (TypeScript)
│   ├── src/
│   │   ├── background.ts # Service worker
│   │   ├── content.ts    # Element selection
│   │   └── element-sender-service.ts
│   ├── dev/              # Development build (with logging)
│   ├── dist/             # Production build (minified)
│   └── manifest.json
│
└── shared/             # @mcp-pointer/shared - Shared TypeScript types
    ├── src/
    │   ├── Logger.ts
    │   └── types.ts
    └── package.json
```

## 🔧 Configuration

### Auto Configuration

```bash
mcp-pointer configure
```

### Manual Configuration

Add to your AI tool's MCP settings (e.g., `~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "@mcp-pointer/server": {
      "command": "mcp-pointer",
      "args": ["start"],
      "env": {}
    }
  }
}
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
- **Component Info**: React/Vue component names and source files  
- **Attributes**: All HTML attributes
- **Position**: Exact coordinates and dimensions
- **Source Hints**: File paths and component origins

## 🔍 Supported Frameworks

- ⚛️ **React** - Component names and source files via Fiber
- 💚 **Vue** - Component detection via Vue devtools data
- 🅰️ **Angular** - Basic component detection
- 📦 **Generic** - Works with any HTML/CSS/JS

## 🌐 Browser Support

- ✅ **Chrome** - Full support
- ✅ **Edge** - Full support  
- 🟡 **Firefox** - Extension needs adaptation
- 🟡 **Safari** - Extension needs adaptation

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

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

**Made with ❤️ for AI-powered web development**

*Now your AI can analyze any element you point at! 👆*