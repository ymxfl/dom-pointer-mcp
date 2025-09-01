import PointerWebSocketServer from './websocket-server';
import MCPHandler from './mcp-handler';
import logger from './logger';

async function start(options: { port: string }) {
  const wsServer = new PointerWebSocketServer(parseInt(options.port, 10));
  const mcpHandler = new MCPHandler(wsServer);

  try {
    await wsServer.start();
    await mcpHandler.start();
    logger.info('👆 MCP Pointer started! Ready to point at elements.');
  } catch (error) {
    logger.error('Failed to start MCP Pointer:', error);
    process.exit(1);
  }
}

export default start;
