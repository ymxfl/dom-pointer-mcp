// Main world script - has full access to React Fiber and can communicate with background
import ElementPointer from './element-pointer';
import logger from './logger';

logger.info('🌍 MCP Pointer content script loaded');

// Initialize main world element pointer
const pointer = new ElementPointer();

if (IS_DEV) {
// Export for potential debugging
  (window as any).pointerTargeter = pointer;
}
