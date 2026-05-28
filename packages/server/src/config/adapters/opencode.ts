import path from 'path';
import os from 'os';
import type { ToolAdapter, OperationResult } from '../types';
import { writeFileEnsuringDir, readJsonOrDefault } from '../adapter-helpers';
import { TRIGGER_NAME, TRIGGER_DESCRIPTION, TRIGGER_BODY } from '../trigger-content';

const MCP_SERVER_NAME = 'pointer';

function buildCommandFile(): string {
  return `---
description: ${JSON.stringify(TRIGGER_DESCRIPTION)}
---

${TRIGGER_BODY}`;
}

function userConfigPath(): string {
  return path.join(os.homedir(), '.config', 'opencode', 'opencode.json');
}

function projectConfigPath(): string {
  return path.join(process.cwd(), 'opencode.json');
}

export const opencodeAdapter: ToolAdapter = {
  toolId: 'opencode',
  displayName: 'OpenCode',

  async registerMcp(scope, port): Promise<OperationResult> {
    const filePath = scope === 'user' ? userConfigPath() : projectConfigPath();
    try {
      const existing = await readJsonOrDefault<Record<string, any>>(filePath, {});
      const existingMcp = (existing.mcp && typeof existing.mcp === 'object') ? existing.mcp : {};
      const merged = {
        ...existing,
        mcp: {
          ...existingMcp,
          [MCP_SERVER_NAME]: {
            type: 'local',
            command: ['npx', '-y', '@mcp-pointer/server@latest', 'start'],
            environment: { MCP_POINTER_PORT: String(port) },
            enabled: true,
          },
        },
      };
      await writeFileEnsuringDir(filePath, JSON.stringify(merged, null, 2));
      return {
        status: 'success', scope, path: filePath,
        message: 'MCP server merged into opencode.json',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installTrigger(scope): Promise<OperationResult> {
    const filePath = scope === 'user'
      ? path.join(os.homedir(), '.config', 'opencode', 'commands', `${TRIGGER_NAME}.md`)
      : path.join(process.cwd(), '.opencode', 'commands', `${TRIGGER_NAME}.md`);
    try {
      await writeFileEnsuringDir(filePath, buildCommandFile());
      return { status: 'success', scope, path: filePath, message: 'Trigger command installed' };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },
};
