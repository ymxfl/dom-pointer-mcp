import path from 'path';
import os from 'os';
import type {
  ToolAdapter, OperationResult, Scope,
} from '../types';
import {
  writeFileEnsuringDir,
  fileExists,
  deleteFileIfExists,
  deleteDirIfExists,
} from '../adapter-helpers';
import {
  TRIGGER_NAME,
  SKILL_DESCRIPTION,
  SKILL_BODY,
} from '../trigger-content';
import { t } from '../i18n';
import logger from '../../logger';

const MCP_SERVER_NAME = 'dom-pointer';
const DEFAULT_PORT = 7007;

function agentsDir(): string {
  return path.join(os.homedir(), '.agents');
}

function mcpJsonPath(): string {
  return path.join(agentsDir(), 'mcp-pointed.json');
}

function skillFilePath(): string {
  return path.join(agentsDir(), 'skills', TRIGGER_NAME, 'SKILL.md');
}

function skillDirPath(): string {
  return path.join(agentsDir(), 'skills', TRIGGER_NAME);
}

function buildMcpJson(port: number): string {
  return JSON.stringify({
    mcpServers: {
      [MCP_SERVER_NAME]: {
        command: 'dom-pointer-mcp',
        args: ['start'],
        env: { MCP_POINTER_PORT: String(port) },
      },
    },
  }, null, 2);
}

function buildSkillFile(): string {
  return `---
name: ${TRIGGER_NAME}
description: ${JSON.stringify(SKILL_DESCRIPTION)}
---

${SKILL_BODY}`;
}

function printMcpBlock(json: string): void {
  const divider = '━━━━━━━━━━━━━━━━━━ MCP Config for dom-pointer ━━━━━━━━━━━━━━━━━━';
  logger.info('');
  logger.info(divider);
  logger.info(json);
  logger.info(divider);
  logger.info('');
}

export const genericAdapter: ToolAdapter = {
  toolId: 'generic',
  displayName: () => t('genericAgentName') as string,

  async registerMcp(): Promise<OperationResult> {
    const filePath = mcpJsonPath();
    const effectiveScope: Scope = 'user';
    try {
      const json = buildMcpJson(DEFAULT_PORT);
      printMcpBlock(json);
      await writeFileEnsuringDir(filePath, json);
      return {
        status: 'success',
        scope: effectiveScope,
        path: filePath,
        message: t('genericMcpHint') as string,
      };
    } catch (e) {
      return {
        status: 'failed',
        scope: effectiveScope,
        message: `Write failed: ${(e as Error).message}`,
      };
    }
  },

  async installSkill(): Promise<OperationResult> {
    const filePath = skillFilePath();
    const effectiveScope: Scope = 'user';
    try {
      await writeFileEnsuringDir(filePath, buildSkillFile());
      return {
        status: 'success',
        scope: effectiveScope,
        path: filePath,
        message: t('genericSkillHint') as string,
      };
    } catch (e) {
      return {
        status: 'failed',
        scope: effectiveScope,
        message: `Write failed: ${(e as Error).message}`,
      };
    }
  },

  async unregisterMcp(): Promise<OperationResult> {
    const filePath = mcpJsonPath();
    const effectiveScope: Scope = 'user';
    if (!(await fileExists(filePath))) {
      return {
        status: 'skipped',
        scope: effectiveScope,
        path: filePath,
        message: 'mcp-pointed.json not found',
      };
    }
    try {
      const r = await deleteFileIfExists(filePath);
      return r === 'deleted'
        ? {
          status: 'success', scope: effectiveScope, path: filePath, message: 'mcp-pointed.json removed',
        }
        : {
          status: 'skipped', scope: effectiveScope, path: filePath, message: 'mcp-pointed.json not found',
        };
    } catch (e) {
      return { status: 'failed', scope: effectiveScope, message: `Delete failed: ${(e as Error).message}` };
    }
  },

  async uninstallSkill(): Promise<OperationResult> {
    const dirPath = skillDirPath();
    const effectiveScope: Scope = 'user';
    try {
      const r = await deleteDirIfExists(dirPath);
      return r === 'deleted'
        ? {
          status: 'success', scope: effectiveScope, path: dirPath, message: 'Skill removed',
        }
        : {
          status: 'skipped', scope: effectiveScope, path: dirPath, message: 'Skill directory not found',
        };
    } catch (e) {
      return { status: 'failed', scope: effectiveScope, message: `Delete failed: ${(e as Error).message}` };
    }
  },
};
