import logger from './logger';

async function configure() {
  logger.info('🔧 To configure MCP Pointer with Claude Code, run this command:');
  logger.info('');
  logger.info('claude mcp add pointer -s user --env MCP_POINTER_PORT=7007 -- mcp-pointer start');
  logger.info('');
  logger.info('This will configure MCP Pointer user-wide across all your projects.');
  logger.info('');
  logger.info('Alternative: For project-specific configuration, use:');
  logger.info('claude mcp add pointer --env MCP_POINTER_PORT=7007 -- mcp-pointer start');
  logger.info('');
  logger.info('💡 You can customize the port by changing MCP_POINTER_PORT=7007 to your preferred port.');
}

export default configure;
