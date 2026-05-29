# @dom-pointer-mcp/server

## 1.0.2

### Patch Changes

- 57007a6: Fix off-screen note panel for viewport-filling elements, add automatic reconnect-and-retry on send failure, and support ESC to clear the current selection.

## 1.0.1

### Changes

- **MCP server key renamed** from `pointer` to `dom-pointer`. The tool surface
  is now `mcp__dom-pointer__get-pointed-element`. Existing client configs
  pointing at the old `"pointer"` key no longer match — re-run
  `npx @dom-pointer-mcp/server config <tool>` to refresh configs for Claude
  Code, Cursor, Codex, OpenCode, Windsurf, or JoyCode.
- **New positional shortcut** for `get-pointed-element`: trailing integers
  `0-3` in the user message (e.g. `/pointed 0 0`, `做一下 1 2`) map to the
  `textDetail` and `cssLevel` parameters and control returned payload size.
  - `textDetail`: 0 (no text) | 1 (visible only) | 2 (full, default)
  - `cssLevel`: 0 (no CSS) | 1 (layout) | 2 (+ box model) | 3 (full, default)
- Shared-state file path changed from `/tmp/mcp-pointer-shared-state.json` to
  `/tmp/dom-pointer-mcp-shared-state.json`. Stale files from the old path can
  be deleted.

## 1.0.0

Initial release.
