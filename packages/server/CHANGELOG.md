# @dom-pointer-mcp/server

## 1.2.0

### Minor Changes

- 6383c64: feat: configurable trigger key with page-level conflict detection

  - Add user-configurable modifier key (Alt/Ctrl/Meta) in popup settings
  - Detect page-level keyboard event listeners via addEventListener interception
  - Show in-page toast notification with alternative key suggestion when conflict detected
  - Platform-aware display names (Option/Command on Mac, Alt/Win on Windows)

## 1.1.2

### Patch Changes

- 6bc0d3c: fix: rewrite prompt rules — userNote drives confirm/execute behavior, call tool with no args when params omitted

## 1.1.1

### Patch Changes

- fd2bd2b: fix: remove auto-trigger from skill description, unify skill/command prompt content, fix /pointed get skipping user confirmation, fix inconsistent cssLevel defaults, slim down MCP tool descriptions to reduce token usage

## 1.1.0

### Minor Changes

- 06d3274: feat(config): add /pointed get subcommand for preview-only inspection of selections
  docs: rewrite README to highlight Skill-based usage, clarify React ≤ 18 support

## 1.0.4

### Patch Changes

- 18a0730: Fix page scroll jump when selecting off-screen elements, guard sendElement against Service Worker init race

## 1.0.3

### Patch Changes

- d176e27: Fix page scroll jump when selecting off-screen elements, guard sendElement against Service Worker init race

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
