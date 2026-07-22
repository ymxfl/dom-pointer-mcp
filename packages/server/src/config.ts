import logger from './logger';
import { getAdapter, listAdapters } from './config/adapters/index';
import { resolveScope } from './config/scope';
import {
  runInteractiveInstall,
  runInteractiveUninstall,
  runNonInteractiveUninstall,
  executeForAgents,
} from './config/orchestrator';
import { selectAction } from './config/prompts';
import { setLang } from './config/i18n';
import type { Scope, LaunchMode } from './config/types';
import { resolveDisplayName } from './config/types';
import parsePort from './utils/port';

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
  global?: boolean;
  /**
   * From commander `--no-slash`.
   * Commander defaults this to true; `--no-slash` sets it to false.
   */
  slash?: boolean;
  lang?: string;
}

function getPort(): string {
  return process.env.MCP_POINTER_PORT || '7007';
}

export default async function configCommand(
  tool?: string,
  opts: ConfigOpts = {},
): Promise<void> {
  if (opts.lang === 'en' || opts.lang === 'zh') {
    setLang(opts.lang);
  }

  let port: number;
  try {
    port = parsePort(getPort());
  } catch (e) {
    logger.error(`❌ ${(e as Error).message}`);
    process.exit(1);
    return;
  }
  const launchMode: LaunchMode = opts.global ? 'global' : 'npx';

  // Interactive flows (no positional tool)
  if (!tool) {
    try {
      const action = opts.uninstall ? 'uninstall' : await selectAction();
      const summary = action === 'uninstall'
        ? await runInteractiveUninstall()
        : await runInteractiveInstall(port);
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
  logger.info(`🔧 Configuring DOM Pointer MCP for ${resolveDisplayName(adapter)} (${scope} scope)...`);
  const summary = await executeForAgents([adapter], {
    mode: 'install',
    scope,
    port,
    // commander `--no-slash` → slash:false; omit flag → slash:true
    withSlash: opts.slash !== false,
    launchMode,
  });
  if (summary.exitCode !== 0) process.exit(summary.exitCode);
}
