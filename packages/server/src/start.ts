import { PointerMessageType, type TargetedElement } from '@mcp-pointer/shared/types';
import WebSocketService from './services/websocket-service';
import MCPService from './services/mcp-service';
import SharedStateService from './services/shared-state-service';
import logger from './logger';

let sharedState: SharedStateService;
let wsService: WebSocketService;
let mcpService: MCPService;

function initializeServices(port: string | number): void {
  sharedState = new SharedStateService();
  wsService = new WebSocketService(port);
  mcpService = new MCPService(sharedState);
}

function setupMessageHandler(): void {
  wsService.registerMessageHandler(async (type: string, data: any) => {
    if (type === PointerMessageType.ELEMENT_SELECTED && data) {
      const element = data as TargetedElement;
      await sharedState.saveCurrentElement(element);
    } else if (type === PointerMessageType.ELEMENT_CLEARED) {
      await sharedState.saveCurrentElement(null);
    }
  });
}

function performCleanup(): void {
  if (wsService) {
    wsService.stop();
  }
}

function gracefulShutdown(): void {
  logger.info('👆 Shutting down MCP Pointer...');
  process.exit(0); // Will trigger 'exit' event -> performCleanup()
}

function setupProcessHandlers(): void {
  // Cleanup on ANY exit (catches process.exit, crashes, etc.)
  process.on('exit', performCleanup);

  // Handle graceful shutdown signals
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGHUP', gracefulShutdown);
  process.on('SIGUSR2', gracefulShutdown); // For nodemon
}

function startWebSocketService(): void {
  wsService.start().catch((error) => {
    // WebSocket errors are non-fatal - MCP can still work
    logger.error('WebSocket service error (non-fatal):', error);
  });
}

async function startMCPService(): Promise<void> {
  await mcpService.start();
}

function handleStartupError(error: unknown): void {
  logger.error('Failed to start MCP service (fatal):', error);
  process.exit(1); // Will trigger cleanup via 'exit' event
}

async function startServices(): Promise<void> {
  try {
    // Start WebSocket in background (non-blocking)
    startWebSocketService();

    // Start MCP service (critical - must succeed)
    await startMCPService();

    logger.info('👆 MCP Pointer started! Ready to point at elements.');
  } catch (error) {
    handleStartupError(error);
  }
}

async function start(options: { port: string }) {
  // Initialize services
  initializeServices(options.port);

  // Setup
  setupMessageHandler();
  setupProcessHandlers();

  // Start services
  await startServices();
}

export default start;
