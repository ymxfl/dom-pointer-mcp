# 🧪 Setup Guide for Testers & Contributors

This guide helps you set up AI Glasses for testing or development without waiting for official npm releases.

## 📋 Prerequisites

- **Node.js** 18+ and **pnpm** installed
- **Chrome** browser for the extension
- **Claude Code** (or another MCP-compatible AI tool)

## 🚀 Quick Setup

### 1. Clone and Build the Repository

```bash
# Clone the repository
git clone <repository-url>
cd tuba_mcp

# Install all dependencies
pnpm install

# Build and link the MCP server globally
pnpm -C packages/mcp link:global
```

This creates a global `glasses` command that points to your local build.

### 2. Install Chrome Extension (Developer Mode)

```bash
# Build the Chrome extension
pnpm -C packages/chrome-extension build

# The extension is now ready in packages/chrome-extension/dist/
```

**Load in Chrome:**
1. Open Chrome → Settings → Extensions → Developer mode (toggle ON)
2. Click "Load unpacked"
3. Select the `packages/chrome-extension/dist/` folder
4. The AI Glasses extension should appear in your extensions list

### 3. Configure Your Working Project

Navigate to any project where you want to use AI Glasses:

```bash
cd /path/to/your/frontend-project

# Auto-configure Claude Code for this project
mcp-pointer configure

# This creates a .mcp.json file in your project
```

The `.mcp.json` will look like:
```json
{
  "mcpServers": {
    "@glasses/mcp": {
      "command": "glasses",
      "args": ["wear"],
      "env": {
        "GLASSES_PORT": "7007"
      }
    }
  }
}
```

### 4. Start Using AI Glasses

```bash
# In your working project, start the MCP server
mcp-pointer start

# Or let Claude Code start it automatically
```

Now you can:
1. **Open any webpage** in Chrome
2. **Option+Click** (Alt+Click on Windows) any element 
3. **Ask Claude Code** to analyze the targeted element!

## 🔄 Making Changes

When you make changes to the AI Glasses code:

```bash
# For MCP server changes
pnpm -C packages/mcp build

# For Chrome extension changes
pnpm -C packages/chrome-extension build
# Then refresh the extension in Chrome → Extensions → Reload
```

## 🧹 Uninstalling

```bash
# Remove the global link
npm unlink -g @glasses/mcp

# Remove from your projects
rm .mcp.json  # In each project that used it
```

## 🐛 Troubleshooting

### MCP Server Issues

```bash
# Check if glasses command is available
mcp-pointer --help

# Test server startup
mcp-pointer start --port 7007

# Check logs with debug level
mcp-pointer start --log-level debug
```

### Chrome Extension Issues

1. **Extension not loading:**
   - Make sure you built with `pnpm -C packages/chrome-extension build`
   - Check the `dist/` folder exists and contains files
   - Reload the extension in Chrome Extensions page

2. **Elements not highlighting:**
   - Try refreshing the webpage
   - Check browser console for errors (F12 → Console)
   - Some pages block content scripts (chrome://, file://, etc.)

3. **WebSocket connection failed:**
   - Make sure MCP server is running (`mcp-pointer start`)
   - Check if port 7007 is blocked by firewall
   - Look for connection errors in browser console

### Claude Code Integration

1. **Tools not appearing:**
   - Restart Claude Code after running `mcp-pointer configure`
   - Check that `.mcp.json` exists in your project root
   - Verify MCP server is running

2. **"Command not found: glasses":**
   - Run `npm link` again in `packages/mcp/` directory
   - Check your `PATH` includes npm global binaries

## 📁 Project Structure

```
tuba_mcp/
├── packages/
│   ├── mcp/                    # MCP Server
│   │   ├── dist/cli.cjs       # Built CLI (created by pnpm build)
│   │   └── src/               # Source code
│   ├── chrome-extension/       # Chrome Extension  
│   │   ├── dist/              # Built extension (created by pnpm build)
│   │   └── src/               # Source code
│   └── shared/                # Shared TypeScript types
└── .mcp.json                  # Local MCP configuration (created by mcp-pointer configure)
```

## 🎯 Testing Checklist

- [ ] MCP server starts with `mcp-pointer start`
- [ ] Chrome extension loads without errors
- [ ] Option+Click highlights elements on webpages
- [ ] Claude Code shows the `getTargetedElement` tool
- [ ] Element data appears when using the tool
- [ ] WebSocket connection indicator shows "Connected"

## 💡 Tips for Testing

1. **Test on different websites** - try React apps, Vue apps, plain HTML
2. **Check component detection** - React Fiber info should appear for React apps
3. **Test responsive elements** - resize browser and check highlighting
4. **Verify CSS extraction** - ensure styles and positions are captured
5. **Test edge cases** - very small elements, overlapping elements, etc.

---

**Questions or issues?** Check the main README.md or create an issue in the repository.

**Happy testing! 👓**