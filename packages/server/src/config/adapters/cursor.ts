import path from 'path';
import os from 'os';
import type { ToolAdapter, OperationResult } from '../types';
import { writeFileEnsuringDir, readJsonOrDefault } from '../adapter-helpers';
import {
  TRIGGER_NAME,
  COMMAND_DESCRIPTION,
  COMMAND_BODY,
  SKILL_DESCRIPTION,
  SKILL_BODY,
} from '../trigger-content';

const MCP_SERVER_NAME = 'pointer';

function buildCommandFile(): string {
  return `---
description: ${JSON.stringify(COMMAND_DESCRIPTION)}
---

${COMMAND_BODY}`;
}

function buildMdcFile(): string {
  return `---
description: ${JSON.stringify(SKILL_DESCRIPTION)}
alwaysApply: false
---

${SKILL_BODY}`;
}

function pointerEntry(port: number) {
  return {
    command: 'npx',
    args: ['-y', '@mcp-pointer/server@latest', 'start'],
    env: { MCP_POINTER_PORT: String(port) },
  };
}

export const cursorAdapter: ToolAdapter = {
  toolId: 'cursor',
  displayName: 'Cursor',

  async registerMcp(scope, port): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.cursor', 'mcp.json');
    try {
      const existing = await readJsonOrDefault<Record<string, any>>(filePath, {});
      const existingServers = (existing.mcpServers && typeof existing.mcpServers === 'object')
        ? existing.mcpServers : {};
      const merged = {
        ...existing,
        mcpServers: {
          ...existingServers,
          [MCP_SERVER_NAME]: pointerEntry(port),
        },
      };
      await writeFileEnsuringDir(filePath, JSON.stringify(merged, null, 2));
      return {
        status: 'success', scope, path: filePath, message: 'MCP server merged into .cursor/mcp.json',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installCommand(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.cursor', 'commands', `${TRIGGER_NAME}.md`);
    try {
      await writeFileEnsuringDir(filePath, buildCommandFile());
      return {
        status: 'success', scope, path: filePath, message: 'Slash command installed',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installSkill(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.cursor', 'rules', `${TRIGGER_NAME}.mdc`);
    try {
      await writeFileEnsuringDir(filePath, buildMdcFile());
      return {
        status: 'success', scope, path: filePath, message: 'Skill rule installed',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },
};
