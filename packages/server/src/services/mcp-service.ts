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
          description: 'Returns the current DOM selection; attaches the selection screenshot and any user-provided reference images as image content when available. '
            + 'Payload: userNote (the user\'s primary instruction), selectionId, elements[] (selector, componentInfo.sourceFile, cssProperties, url — reference by 1-based index for [1]/[2] notation), screenshot.path, and referenceImages[] (external images the user pasted — NOT the selected element\'s current appearance; their purpose is described in userNote, e.g. "改成参考图的样式"). For visual changes inspect the attached image content directly. '
            + 'EXECUTE (default, i.e. /pointed with no "get" prefix): if userNote is non-empty, apply the requested source-code changes IMMEDIATELY without asking for confirmation; if userNote is empty, ask the user what to do and wait. '
            + 'GET (when invoked via /pointed get, read-only preview): do NOT modify any files. First summarize the elements (page URL, userNote, and each element\'s component name, source file, tag), then ask the user to confirm via the ask tool and STOP — take no other action (no searching, reading, or code analysis) until they reply. If they cancel, respond "已取消" and end. '
            + 'If no selection exists, tell the user to Option+Click elements in the browser and press Cmd/Ctrl+Enter before retrying.',
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
          description: 'Lists recent pointed DOM selections (read-only). Return a compact list: selectionId, timestamp, elementCount, userNote preview, and screenshotPath when present. Do not modify files.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: MCPToolName.GET_POINTED_SELECTION,
          description: 'Returns a recent DOM selection by selectionId and attaches its screenshot plus any user-provided reference images as image content when available. Payload shape matches get-pointed-element. After fetching, follow EXECUTE behavior on this historical selection (apply changes when userNote is non-empty); text the user typed after the selectionId refines userNote.',
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
          description: 'Clears all stored pointed selections, or one by selectionId (pass the id after /pointed clear; omit to clear all). Report only the removed count.',
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
          description: 'Checks npm for a newer @dom-pointer-mcp/server; with action "apply" installs it globally, "check" (default) only compares. Report currentVersion, latestVersion, updateAvailable, launchHint, applied, and message. Do not modify project source files. '
            + 'When an update was applied (or for npx launches, to pick up @latest), the running MCP server must be replaced: tell the user to first kill ALL existing dom-pointer MCP processes (e.g. `pkill -f dom-pointer-mcp`), then restart the agent session so a fresh server starts on the new version. Extension updates are handled in the Chrome extension popup, not here.',
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
      referenceImages: selection.referenceImages,
      elements: selection.elements.map((el) => serializeElement(
        el,
        details.textDetail,
        details.cssLevel,
      )),
    };

    return {
      content: await buildSelectionContent(
        payload,
        selection.screenshot,
        selection.referenceImages,
      ),
    };
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
      referenceImages: selection.referenceImages,
      elements: selection.elements.map((el) => serializeElement(
        el,
        details.textDetail,
        details.cssLevel,
      )),
    };

    return {
      content: await buildSelectionContent(
        payload,
        selection.screenshot,
        selection.referenceImages,
      ),
    };
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
