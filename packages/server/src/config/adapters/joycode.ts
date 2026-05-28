import path from 'path';
import os from 'os';
import type { ToolAdapter, OperationResult, Scope } from '../types';
import { writeFileEnsuringDir, readJsonOrDefault } from '../adapter-helpers';
import { TRIGGER_DESCRIPTION, TRIGGER_BODY } from '../trigger-content';

const MCP_SERVER_NAME = 'pointer';
const PROMPT_NAME = 'pointerPointed';
const POINTER_PREFIX = 'pointer';

function buildMcpJson(port: number) {
  return JSON.stringify({
    mcpServers: {
      [MCP_SERVER_NAME]: {
        command: 'npx',
        args: ['-y', '@mcp-pointer/server@latest', 'start'],
        env: { MCP_POINTER_PORT: String(port) },
      },
    },
  }, null, 2);
}

function buildPromptEntry() {
  return {
    label: 'pointed',
    name: PROMPT_NAME,
    description: TRIGGER_DESCRIPTION,
    prompt: TRIGGER_BODY,
    source: 'project' as const,
  };
}

export const joycodeAdapter: ToolAdapter = {
  toolId: 'joycode',
  displayName: 'JoyCode',

  async registerMcp(scope, port): Promise<OperationResult> {
    const filePath = scope === 'user'
      ? path.join(os.homedir(), '.joycode', 'joycode-mcp.json')
      : path.join(process.cwd(), '.joycode', 'mcp.json');
    try {
      await writeFileEnsuringDir(filePath, buildMcpJson(port));
      return {
        status: 'success', scope, path: filePath, message: 'MCP server registered',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installTrigger(scope): Promise<OperationResult> {
    const isDegraded = scope === 'user';
    const effectiveScope: Scope = 'project';
    const filePath = path.join(process.cwd(), '.joycode', 'prompt.json');
    try {
      const existing = await readJsonOrDefault<any[]>(filePath, []);
      const arr = Array.isArray(existing) ? existing : [];
      const filtered = arr.filter((e) => !(e && typeof e === 'object'
          && typeof (e as any).name === 'string'
          && (e as any).name.startsWith(POINTER_PREFIX)));
      const next = [...filtered, buildPromptEntry()];
      await writeFileEnsuringDir(filePath, JSON.stringify(next, null, 2));
      return {
        status: isDegraded ? 'degraded' : 'success',
        scope: effectiveScope,
        path: filePath,
        message: isDegraded
          ? 'JoyCode only supports project-level prompts; installed at project scope.'
          : 'Trigger prompt merged into .joycode/prompt.json',
      };
    } catch (e) {
      return {
        status: 'failed',
        scope: effectiveScope,
        message: `Write failed: ${(e as Error).message}`,
      };
    }
  },
};
