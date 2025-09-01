import CLICommand from './commands';
import logger from './logger';

export default function showConfig() {
  const config = {
    mcpServers: {
      '@glasses/mcp': {
        command: 'glasses',
        args: [CLICommand.WEAR],
        env: {},
      },
    },
  };

  logger.info('Add this to your AI tool\'s MCP settings:');
  logger.info(JSON.stringify(config, null, 2));
}
