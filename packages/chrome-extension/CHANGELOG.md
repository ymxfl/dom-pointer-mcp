# @dom-pointer-mcp/chrome-extension

## 1.3.0

### Minor Changes

- c662488: Chrome 扩展全面国际化：Popup、Content Script、manifest 支持中英文切换

## 1.2.1

### Patch Changes

- dd34422: 修复 HTTP 页面上复制按钮报错的问题，当 navigator.clipboard 不可用时降级使用 execCommand

## 1.2.0

### Minor Changes

- 6383c64: feat: configurable trigger key with page-level conflict detection

  - Add user-configurable modifier key (Alt/Ctrl/Meta) in popup settings
  - Detect page-level keyboard event listeners via addEventListener interception
  - Show in-page toast notification with alternative key suggestion when conflict detected
  - Platform-aware display names (Option/Command on Mac, Alt/Win on Windows)

## 1.1.3

### Patch Changes

- 9065d2d: Add fallback for `crypto.randomUUID` in non-secure contexts (e.g. plain HTTP)

## 1.1.0

### Patch Changes

- 06d3274: feat(config): add /pointed get subcommand for preview-only inspection of selections
  docs: rewrite README to highlight Skill-based usage, clarify React ≤ 18 support

## 1.0.4

### Patch Changes

- 18a0730: Fix page scroll jump when selecting off-screen elements, guard sendElement against Service Worker init race

## 1.0.3

### Patch Changes

- d176e27: Fix page scroll jump when selecting off-screen elements, guard sendElement against Service Worker init race

## 1.0.1

### Changes

- Updated tool reference in code comments to `mcp__dom-pointer__get-pointed-element`
  to match the renamed MCP server key (see `@dom-pointer-mcp/server` 1.0.1).
- No behavioral changes in the extension itself.

## 1.0.0

Initial release.
