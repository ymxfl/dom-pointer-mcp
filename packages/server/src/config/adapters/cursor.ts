import path from 'path';
import os from 'os';
import type { ToolAdapter, OperationResult } from '../types';
import { writeFileEnsuringDir } from '../adapter-helpers';
import { TRIGGER_NAME, TRIGGER_DESCRIPTION, TRIGGER_BODY } from '../trigger-content';

const MCP_SERVER_NAME = 'pointer';

function buildMdcFile(): string {
  return `---
description: ${JSON.stringify(TRIGGER_DESCRIPTION)}
alwaysApply: false
---

${TRIGGER_BODY}`;
}

function buildMcpJson(port: number): string {
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

export const cursorAdapter: ToolAdapter = {
  toolId: 'cursor',
  displayName: 'Cursor',

  async registerMcp(scope, port): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.cursor', 'mcp.json');
    try {
      await writeFileEnsuringDir(filePath, buildMcpJson(port));
      return {
        status: 'success', scope, path: filePath,
        message: 'MCP server registered',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installTrigger(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.cursor', 'rules', `${TRIGGER_NAME}.mdc`);
    try {
      await writeFileEnsuringDir(filePath, buildMdcFile());
      return { status: 'success', scope, path: filePath, message: 'Trigger rule installed' };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },
};
