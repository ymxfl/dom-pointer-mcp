import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import type { ToolAdapter, OperationResult, LaunchMode } from '../types';
import {
  writeFileEnsuringDir,
  readJsonOrDefault,
  fileExists,
  deleteFileIfExists,
  removeJsonKey,
} from '../adapter-helpers';
import {
  TRIGGER_NAME,
  COMMAND_DESCRIPTION,
  COMMAND_BODY,
  SKILL_DESCRIPTION,
  SKILL_BODY,
} from '../trigger-content';

const MCP_SERVER_NAME = 'dom-pointer';

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

function pointerEntry(port: number, launchMode: LaunchMode = 'npx') {
  if (launchMode === 'global') {
    return {
      command: 'dom-pointer-mcp',
      args: ['start'],
      env: { MCP_POINTER_PORT: String(port) },
    };
  }
  return {
    command: 'npx',
    args: ['-y', '@dom-pointer-mcp/server@latest', 'start'],
    env: { MCP_POINTER_PORT: String(port) },
  };
}

export const claudeAdapter: ToolAdapter = {
  toolId: 'claude',
  displayName: 'Claude Code',

  async registerMcp(scope, port, launchMode: LaunchMode = 'npx'): Promise<OperationResult> {
    if (scope === 'user') {
      try {
        try {
          execSync(`claude mcp remove ${MCP_SERVER_NAME} -s user`, { stdio: 'pipe' });
        } catch { /* ignore: not installed */ }
        const cmdArgs = launchMode === 'global'
          ? 'dom-pointer-mcp start'
          : 'npx -y @dom-pointer-mcp/server@latest start';
        execSync(
          `claude mcp add ${MCP_SERVER_NAME} -s user --env MCP_POINTER_PORT=${port} `
          + `-- ${cmdArgs}`,
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
      const existing = await readJsonOrDefault<Record<string, any>>(filePath, {});
      const existingServers = (existing.mcpServers && typeof existing.mcpServers === 'object')
        ? existing.mcpServers : {};
      const merged = {
        ...existing,
        mcpServers: {
          ...existingServers,
          [MCP_SERVER_NAME]: pointerEntry(port, launchMode),
        },
      };
      await writeFileEnsuringDir(filePath, JSON.stringify(merged, null, 2));
      return {
        status: 'success',
        scope,
        path: filePath,
        message: 'MCP server merged into .mcp.json',
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

  async unregisterMcp(scope): Promise<OperationResult> {
    if (scope === 'user') {
      try {
        execSync(`claude mcp remove ${MCP_SERVER_NAME} -s user`, { stdio: 'pipe' });
        return {
          status: 'success',
          scope,
          path: 'claude mcp remove -s user',
          message: 'MCP server removed (user scope)',
        };
      } catch (e) {
        return {
          status: 'skipped',
          scope,
          message: `No user-scope MCP entry found (${(e as Error).message.slice(0, 80)})`,
        };
      }
    }
    const filePath = path.join(process.cwd(), '.mcp.json');
    if (!(await fileExists(filePath))) {
      return {
        status: 'skipped', scope, path: filePath, message: '.mcp.json not found',
      };
    }
    try {
      const existing = await readJsonOrDefault<Record<string, any>>(filePath, {});
      const removed = removeJsonKey(existing, ['mcpServers', MCP_SERVER_NAME]);
      if (!removed) {
        return {
          status: 'skipped', scope, path: filePath, message: 'pointer entry not present',
        };
      }
      await writeFileEnsuringDir(filePath, JSON.stringify(existing, null, 2));
      return {
        status: 'success', scope, path: filePath, message: 'pointer entry removed from .mcp.json',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Edit failed: ${(e as Error).message}` };
    }
  },

  async uninstallCommand(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.claude', 'commands', `${TRIGGER_NAME}.md`);
    try {
      const r = await deleteFileIfExists(filePath);
      return r === 'deleted'
        ? {
          status: 'success', scope, path: filePath, message: 'Slash command removed',
        }
        : {
          status: 'skipped', scope, path: filePath, message: 'Slash command file not found',
        };
    } catch (e) {
      return { status: 'failed', scope, message: `Delete failed: ${(e as Error).message}` };
    }
  },

  async uninstallSkill(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.claude', 'skills', TRIGGER_NAME, 'SKILL.md');
    try {
      const r = await deleteFileIfExists(filePath);
      return r === 'deleted'
        ? {
          status: 'success', scope, path: filePath, message: 'Skill removed',
        }
        : {
          status: 'skipped', scope, path: filePath, message: 'Skill file not found',
        };
    } catch (e) {
      return { status: 'failed', scope, message: `Delete failed: ${(e as Error).message}` };
    }
  },
};
