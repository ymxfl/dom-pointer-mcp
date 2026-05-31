import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { version } from 'process';
import { CSS_DETAIL_OPTIONS, TEXT_DETAIL_OPTIONS } from '@dom-pointer-mcp/shared/detail';
import SharedStateService from './shared-state-service';
import {
  normalizeDetailParameters,
  serializeElement,
  type DetailParameters,
  type NormalizedDetailParameters,
} from '../utils/element-detail';

enum MCPToolName {
  GET_POINTED_ELEMENT = 'get-pointed-element',
}

enum MCPServerName {
  MCP_POINTER = 'dom-pointer-mcp',
}

export default class MCPService {
  private server: Server;

  private sharedState: SharedStateService;

  constructor(sharedState: SharedStateService) {
    this.sharedState = sharedState;
    this.server = new Server(
      {
        name: MCPServerName.MCP_POINTER,
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
          description: 'Returns { userNote, url, timestamp, elements: [...] } for the currently pointed DOM selection.',
          inputSchema: {
            type: 'object',
            properties: {
              textDetail: {
                type: 'integer',
                enum: [...TEXT_DETAIL_OPTIONS],
                description: '0 none | 1 visible | 2 full; default 2',
              },
              cssLevel: {
                type: 'integer',
                enum: [...CSS_DETAIL_OPTIONS],
                description: '0 none | 1 layout (default) | 2 box-model | 3 full',
              },
            },
            required: [],
          },
        },
      ],
    };
  }

  private async handleCallTool(request: any) {
    if (request.params.name === MCPToolName.GET_POINTED_ELEMENT) {
      const normalized = normalizeDetailParameters(
        request.params.arguments as DetailParameters | undefined,
      );
      return this.getPointedSelection(normalized);
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  private async getPointedSelection(details: NormalizedDetailParameters) {
    const selection = await this.sharedState.getPointedSelection();

    if (!selection) {
      return {
        content: [
          {
            type: 'text',
            text: 'No selection pointed. The user needs to Option+Click '
              + 'elements in their browser, write a note describing what '
              + 'they want changed, then press Cmd/Ctrl+Enter or Send.',
          },
        ],
      };
    }

    const payload = {
      userNote: selection.userNote,
      url: selection.url,
      timestamp: selection.timestamp,
      elements: selection.elements.map((el) => serializeElement(
        el,
        details.textDetail,
        details.cssLevel,
      )),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(payload, null, 2),
        },
      ],
    };
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
