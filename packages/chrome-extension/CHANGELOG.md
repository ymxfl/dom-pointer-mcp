# @mcp-pointer/chrome-extension

## 0.2.0

### Minor Changes

- Major overlay system architecture and performance improvements

  - Complete redesign of overlay calculation, tracking, and rendering system
  - Significantly optimize overlay performance and responsiveness
  - Move to service-based architecture with dedicated services directory
  - Add new overlay-service with improved positioning algorithms
  - Add style-service with optimized CSS injection and management
  - Extract element-pointer logic into dedicated service
  - Remove legacy overlay-manager and styles implementation

### Patch Changes

- Updated dependencies
  - @mcp-pointer/shared@0.2.0
