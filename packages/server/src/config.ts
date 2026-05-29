import logger from './logger';
import { getAdapter, listAdapters } from './config/adapters/index';
import { resolveScope } from './config/scope';
import {
  runInteractiveInstall,
  runInteractiveUninstall,
  runNonInteractiveUninstall,
  executeForAgents,
} from './config/orchestrator';
import type { Scope } from './config/types';

// ============================================================
// Public runtime exports (used by start.ts and friends)
// ============================================================

export interface MCPConfig {
  websocket: {
    port: number;
  };
}

export const config: MCPConfig = {
  websocket: {
    port: 7007,
  },
};

// ============================================================
// CLI config command (used by cli.ts)
// ============================================================

export enum SupportedTool {
  CLAUDE = 'claude',
  CURSOR = 'cursor',
  WINDSURF = 'windsurf',
  CODEX = 'codex',
  OPENCODE = 'opencode',
  JOYCODE = 'joycode',
}

export interface ConfigOpts {
  scope?: string;
  uninstall?: boolean;
}

function getPort(): string {
  return process.env.MCP_POINTER_PORT || '7007';
}

export default async function configCommand(
  tool?: string,
  opts: ConfigOpts = {},
): Promise<void> {
  const port = parseInt(getPort(), 10);

  // Interactive flows (no positional tool)
  if (!tool && !opts.uninstall) {
    try {
      const summary = await runInteractiveInstall(port);
      if (summary.exitCode !== 0) process.exit(summary.exitCode);
      return;
    } catch (e) {
      logger.error(`❌ ${(e as Error).message}`);
      process.exit(1);
      return;
    }
  }
  if (!tool && opts.uninstall) {
    try {
      const summary = await runInteractiveUninstall();
      if (summary.exitCode !== 0) process.exit(summary.exitCode);
      return;
    } catch (e) {
      logger.error(`❌ ${(e as Error).message}`);
      process.exit(1);
      return;
    }
  }

  // Non-interactive: tool is provided
  let scope: Scope;
  try {
    scope = await resolveScope(opts.scope);
  } catch (e) {
    logger.error(`❌ ${(e as Error).message}`);
    process.exit(1);
    return;
  }

  if (opts.uninstall) {
    const summary = await runNonInteractiveUninstall(tool!, scope);
    if (summary.exitCode !== 0) process.exit(summary.exitCode);
    return;
  }

  // Legacy install path
  const adapter = getAdapter(tool!);
  if (!adapter) {
    logger.error(`❌ Unsupported tool: ${tool}`);
    logger.error(`Supported tools: ${listAdapters().map((a) => a.toolId).join(', ')}`);
    process.exit(1);
    return;
  }
  logger.info(`🔧 Configuring MCP Pointer for ${adapter.displayName} (${scope} scope)...`);
  const summary = await executeForAgents([adapter], {
    mode: 'install', scope, port, withSlash: true,
  });
  if (summary.exitCode !== 0) process.exit(summary.exitCode);
}
