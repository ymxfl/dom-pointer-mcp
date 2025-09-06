# @mcp-pointer/shared

## 0.3.0

### Patch Changes

- feat(server): Add multi-instance support with port-based leader election

  - Implement port-based leader election for WebSocket server management
  - Add shared state persistence to filesystem (/tmp/mcp-pointer-shared-state.json)
  - Support multiple MCP server instances without port conflicts
  - Add automatic failover when leader instance crashes (~5 second recovery)
  - Refactor services into dedicated service layer (WebSocketService, MCPService, SharedStateService)
  - Add comprehensive test suite using Node.js built-in test runner
  - Add architecture documentation with Mermaid diagram to CONTRIBUTING.md
  - Rename WebSocketMessageType to PointerMessageType for better domain clarity
  - Add proper process cleanup handling on Ctrl+C and other signals
  - MCP service now runs independently on all instances (leader and followers)

  Breaking changes: None - fully backwards compatible with single instance deployments

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
