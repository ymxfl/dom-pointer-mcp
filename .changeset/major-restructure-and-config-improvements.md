---
"@mcp-pointer/server": minor
"@mcp-pointer/chrome-extension": patch
---

Major restructure and configuration improvements

- **README restructure**: Complete rewrite with cleaner organization (Example section, Getting Started, How it Works, etc.)
- **New automatic config command**: Replace `configure` and `show-config` with unified `config` command that automatically configures AI tools
- **Rename "other" to "manual"**: Clearer naming for manual configuration option suitable for other MCP-compatible tools
- **SupportedTool enum**: Convert tool names to enum for better type safety 
- **Jest configuration**: Auto-detect tsconfig instead of manual TypeScript settings
- **Test improvements**: Full test coverage for config command with enum usage
- **Chrome extension**: Add icon and improve build process for assets