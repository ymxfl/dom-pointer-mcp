import path from 'path';
import os from 'os';
import type { ToolAdapter, OperationResult, LaunchMode } from '../types';
import {
  writeFileEnsuringDir,
  readJsonOrDefault,
  fileExists,
  deleteFileIfExists,
  deleteDirIfExists,
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

function skillPath(scope: 'user' | 'project'): string {
  return scope === 'user'
    ? path.join(os.homedir(), '.config', 'opencode', 'skills', TRIGGER_NAME, 'SKILL.md')
    : path.join(process.cwd(), '.opencode', 'skills', TRIGGER_NAME, 'SKILL.md');
}

function skillDir(scope: 'user' | 'project'): string {
  return path.dirname(skillPath(scope));
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

  async registerMcp(scope, port, launchMode: LaunchMode = 'npx'): Promise<OperationResult> {
    const filePath = scope === 'user' ? userConfigPath() : projectConfigPath();
    try {
      const existing = await readJsonOrDefault<Record<string, any>>(filePath, {});
      const existingMcp = (existing.mcp && typeof existing.mcp === 'object') ? existing.mcp : {};
      const cmd = launchMode === 'global'
        ? ['dom-pointer-mcp', 'start']
        : ['npx', '-y', '--registry=https://registry.npmjs.org/', '@dom-pointer-mcp/server@latest', 'start'];
      const merged = {
        ...existing,
        mcp: {
          ...existingMcp,
          [MCP_SERVER_NAME]: {
            type: 'local',
            command: cmd,
            environment: { MCP_POINTER_PORT: String(port) },
            enabled: true,
          },
        },
      };
      await writeFileEnsuringDir(filePath, JSON.stringify(merged, null, 2));
      return {
        status: 'success',
        scope,
        path: filePath,
        message: 'MCP server merged into opencode.json',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installCommand(scope): Promise<OperationResult> {
    const filePath = scope === 'user'
      ? path.join(os.homedir(), '.config', 'opencode', 'commands', `${TRIGGER_NAME}.md`)
      : path.join(process.cwd(), '.opencode', 'commands', `${TRIGGER_NAME}.md`);
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
    const filePath = skillPath(scope);
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
    const filePath = scope === 'user' ? userConfigPath() : projectConfigPath();
    if (!(await fileExists(filePath))) {
      return {
        status: 'skipped', scope, path: filePath, message: 'opencode.json not found',
      };
    }
    try {
      const existing = await readJsonOrDefault<Record<string, any>>(filePath, {});
      const removed = removeJsonKey(existing, ['mcp', MCP_SERVER_NAME]);
      if (!removed) {
        return {
          status: 'skipped', scope, path: filePath, message: 'pointer entry not present',
        };
      }
      await writeFileEnsuringDir(filePath, JSON.stringify(existing, null, 2));
      return {
        status: 'success', scope, path: filePath, message: 'pointer entry removed',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Edit failed: ${(e as Error).message}` };
    }
  },

  async uninstallCommand(scope): Promise<OperationResult> {
    const filePath = scope === 'user'
      ? path.join(os.homedir(), '.config', 'opencode', 'commands', `${TRIGGER_NAME}.md`)
      : path.join(process.cwd(), '.opencode', 'commands', `${TRIGGER_NAME}.md`);
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
    const dirPath = skillDir(scope);
    try {
      const r = await deleteDirIfExists(dirPath);
      return r === 'deleted'
        ? {
          status: 'success', scope, path: dirPath, message: 'Skill removed',
        }
        : {
          status: 'skipped', scope, path: dirPath, message: 'Skill directory not found',
        };
    } catch (e) {
      return { status: 'failed', scope, message: `Delete failed: ${(e as Error).message}` };
    }
  },
};
