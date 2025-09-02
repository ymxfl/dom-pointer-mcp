import CLICommand from './commands';
import logger from './logger';

export default function showConfig() {
  const config = {
    mcpServers: {
      '@mcp-pointer/server': {
        command: 'mcp-pointer',
        args: [CLICommand.START],
        env: {
          MCP_POINTER_PORT: '7007',
        },
      },
    },
  };

  logger.info('📋 Manual MCP configuration for your AI tool:');
  logger.info('');
  logger.info('Add this to your AI tool\'s MCP settings (e.g., ~/.claude/settings.json):');
  logger.info('');
  logger.info(JSON.stringify(config, null, 2));
  logger.info('');
  logger.info('💡 Recommended: Use Claude MCP CLI instead:');
  logger.info('claude mcp add pointer -s user --env MCP_POINTER_PORT=7007 -- mcp-pointer start');
}
