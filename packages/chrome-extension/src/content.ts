// Main world script - has full access to React Fiber and can communicate with background
import ElementPointerService from './services/element-pointer-service';
import logger from './logger';

logger.debug('🌍 MCP Pointer content script loaded');

// Initialize main world element pointer
const pointer = new ElementPointerService();

if (IS_DEV) {
// Export for potential debugging
  (window as any).pointerTargeter = pointer;
}
