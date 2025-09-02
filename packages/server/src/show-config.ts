import CLICommand from './commands';
import logger from './logger';

export default function showConfig() {
  const config = {
    mcpServers: {
      '@mcp-pointer/server': {
        command: 'mcp-pointer',
        args: [CLICommand.START],
        env: {},
      },
    },
  };

  logger.info('Add this to your AI tool\'s MCP settings:');
  logger.info(JSON.stringify(config, null, 2));
}
