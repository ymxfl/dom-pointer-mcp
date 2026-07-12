import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CSS_DETAIL_OPTIONS, TEXT_DETAIL_OPTIONS } from '@dom-pointer-mcp/shared/detail';
import SharedStateService from './shared-state-service';
import {
  normalizeDetailParameters,
  serializeElement,
  type DetailParameters,
  type NormalizedDetailParameters,
} from '../utils/element-detail';
import serverVersion from '../version';
import buildSelectionContent from '../utils/selection-content';
import { runServerUpdate, type UpdateAction } from './update-service';

enum MCPToolName {
  GET_POINTED_ELEMENT = 'get-pointed-element',
  LIST_POINTED_SELECTIONS = 'list-pointed-selections',
  GET_POINTED_SELECTION = 'get-pointed-selection',
  CLEAR_POINTED_SELECTIONS = 'clear-pointed-selections',
  CHECK_UPDATE = 'check-update',
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
        version: serverVersion,
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
          description: 'Returns the current DOM selection and attaches its screenshot as image content when available.',
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
        {
          name: MCPToolName.LIST_POINTED_SELECTIONS,
          description: 'Lists recent pointed DOM selections with ids, notes, counts, and screenshots.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: MCPToolName.GET_POINTED_SELECTION,
          description: 'Returns a recent DOM selection by selectionId and attaches its screenshot as image content when available.',
          inputSchema: {
            type: 'object',
            properties: {
              selectionId: {
                type: 'string',
                description: 'Selection id from list-pointed-selections.',
              },
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
            required: ['selectionId'],
          },
        },
        {
          name: MCPToolName.CLEAR_POINTED_SELECTIONS,
          description: 'Clears all stored pointed selections, or one selection by selectionId.',
          inputSchema: {
            type: 'object',
            properties: {
              selectionId: {
                type: 'string',
                description: 'Optional selection id. Omit to clear all selections.',
              },
            },
            required: [],
          },
        },
        {
          name: MCPToolName.CHECK_UPDATE,
          description: 'Checks npm for a newer @dom-pointer-mcp/server, optionally applies a global install.',
          inputSchema: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['check', 'apply'],
                description: 'check (default) compares versions; apply installs globally when needed.',
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

    if (request.params.name === MCPToolName.LIST_POINTED_SELECTIONS) {
      return this.listPointedSelections();
    }

    if (request.params.name === MCPToolName.GET_POINTED_SELECTION) {
      const args = request.params.arguments as (
        DetailParameters & { selectionId?: string }
      ) | undefined;
      const normalized = normalizeDetailParameters(args);
      return this.getPointedSelectionById(args?.selectionId, normalized);
    }

    if (request.params.name === MCPToolName.CLEAR_POINTED_SELECTIONS) {
      const args = request.params.arguments as { selectionId?: string } | undefined;
      return this.clearPointedSelections(args?.selectionId);
    }

    if (request.params.name === MCPToolName.CHECK_UPDATE) {
      const args = request.params.arguments as { action?: UpdateAction } | undefined;
      const action: UpdateAction = args?.action === 'apply' ? 'apply' : 'check';
      const result = await runServerUpdate(action);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
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
      selectionId: selection.selectionId,
      userNote: selection.userNote,
      url: selection.url,
      timestamp: selection.timestamp,
      screenshot: selection.screenshot,
      elements: selection.elements.map((el) => serializeElement(
        el,
        details.textDetail,
        details.cssLevel,
      )),
    };

    return { content: await buildSelectionContent(payload, selection.screenshot) };
  }

  private async getPointedSelectionById(
    selectionId: string | undefined,
    details: NormalizedDetailParameters,
  ) {
    if (!selectionId) {
      throw new Error('selectionId is required');
    }

    const selection = await this.sharedState.getPointedSelectionById(selectionId);
    if (!selection) {
      return {
        content: [
          {
            type: 'text',
            text: `No pointed selection found for selectionId: ${selectionId}`,
          },
        ],
      };
    }

    const payload = {
      selectionId: selection.selectionId,
      userNote: selection.userNote,
      url: selection.url,
      timestamp: selection.timestamp,
      screenshot: selection.screenshot,
      elements: selection.elements.map((el) => serializeElement(
        el,
        details.textDetail,
        details.cssLevel,
      )),
    };

    return { content: await buildSelectionContent(payload, selection.screenshot) };
  }

  private async listPointedSelections() {
    const selections = await this.sharedState.listPointedSelections();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ selections }, null, 2),
        },
      ],
    };
  }

  private async clearPointedSelections(selectionId?: string) {
    const removed = await this.sharedState.clearPointedSelections(selectionId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ removed }, null, 2),
        },
      ],
    };
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
