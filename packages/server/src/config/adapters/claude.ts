import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import type { ToolAdapter, OperationResult } from '../types';
import { writeFileEnsuringDir } from '../adapter-helpers';
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

function buildSkillFile(): string {
  return `---
name: ${TRIGGER_NAME}
description: ${JSON.stringify(SKILL_DESCRIPTION)}
---

${SKILL_BODY}`;
}

function buildProjectMcpJson(port: number): string {
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

export const claudeAdapter: ToolAdapter = {
  toolId: 'claude',
  displayName: 'Claude Code',

  async registerMcp(scope, port): Promise<OperationResult> {
    if (scope === 'user') {
      try {
        try {
          execSync(`claude mcp remove ${MCP_SERVER_NAME} -s user`, { stdio: 'pipe' });
        } catch { /* ignore: not installed */ }
        execSync(
          `claude mcp add ${MCP_SERVER_NAME} -s user --env MCP_POINTER_PORT=${port} `
          + '-- npx -y @mcp-pointer/server@latest start',
          { stdio: 'pipe' },
        );
        return {
          status: 'success',
          scope,
          path: 'claude mcp add -s user',
          message: 'MCP server registered (user scope)',
        };
      } catch (e) {
        return {
          status: 'failed',
          scope,
          message: `claude mcp add failed: ${(e as Error).message}. Is Claude Code CLI installed?`,
        };
      }
    }
    const filePath = path.join(process.cwd(), '.mcp.json');
    try {
      await writeFileEnsuringDir(filePath, buildProjectMcpJson(port));
      return {
        status: 'success',
        scope,
        path: filePath,
        message: 'MCP server registered at .mcp.json',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installCommand(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.claude', 'commands', `${TRIGGER_NAME}.md`);
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
    const filePath = path.join(base, '.claude', 'skills', TRIGGER_NAME, 'SKILL.md');
    try {
      await writeFileEnsuringDir(filePath, buildSkillFile());
      return {
        status: 'success', scope, path: filePath, message: 'Skill installed',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },
};
