import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import logger from './logger';

async function configure() {
  try {
    const mcpConfigPath = join(process.cwd(), '.mcp.json');
    let config: any = {};

    try {
      const existingConfig = readFileSync(mcpConfigPath, 'utf8');
      config = JSON.parse(existingConfig);
    } catch {
      config = {};
    }

    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    config.mcpServers['@mcp-pointer/server'] = {
      command: 'mcp-pointer',
      args: ['start'],
      env: {
        MCP_POINTER_PORT: '7007',
      },
    };

    writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2));
    logger.info('✅ MCP Pointer configured for Claude Code in current project!');
    logger.info('Created .mcp.json with pointer configuration.');
  } catch (error) {
    logger.error('Failed to configure Claude Code:', error);
    process.exit(1);
  }
}

export default configure;
