import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { version } from 'process';
import type PointerWebSocketServer from './websocket-server';

enum MCPToolName {
  GET_POINTED_ELEMENT = 'get-pointed-element',
}

enum MCPServerName {
  MCP_POINTER_SERVER = '@mcp-pointer/server',
}

export default class MCPHandler {
  private server: Server;

  private wsServer: PointerWebSocketServer;

  constructor(wsServer: PointerWebSocketServer) {
    this.wsServer = wsServer;
    this.server = new Server(
      {
        name: MCPServerName.MCP_POINTER_SERVER,
        version,
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, this.handleListTools.bind(this));
    this.server.setRequestHandler(CallToolRequestSchema, this.handleCallTool.bind(this));
  }

  private async handleListTools() {
    return {
      tools: [
        {
          name: MCPToolName.GET_POINTED_ELEMENT,
          description: 'Get information about the currently pointed/shown DOM element from the browser extension, in order to let you see a specific element the user is showing you on his/her the browser.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ],
    };
  }

  private async handleCallTool(request: any) {
    if (request.params.name === MCPToolName.GET_POINTED_ELEMENT) {
      return this.getTargetedElement();
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  private getTargetedElement() {
    const element = this.wsServer.getCurrentElement();

    if (!element) {
      return {
        content: [
          {
            type: 'text',
            text: 'No element is currently pointed. '
              + 'The user needs to point an element in their browser using Option+Click.',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(element, null, 2),
        },
      ],
    };
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
