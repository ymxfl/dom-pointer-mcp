import { execFile } from 'child_process';
import { promisify } from 'util';
import { isNewerVersion } from '../utils/semver';
import serverVersion from '../version';

const execFileAsync = promisify(execFile);

export const NPM_PACKAGE_NAME = '@dom-pointer-mcp/server';
export const NPM_LATEST_URL = `https://registry.npmjs.org/${NPM_PACKAGE_NAME}/latest`;

export type UpdateAction = 'check' | 'apply';
export type LaunchHint = 'npx' | 'global' | 'unknown';

export interface ServerUpdateResult {
  action: UpdateAction;
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  launchHint: LaunchHint;
  applied: boolean;
  message: string;
}

export interface UpdateServiceDeps {
  getCurrentVersion: () => string;
  fetchLatestVersion: () => Promise<string>;
  detectLaunchHint: () => LaunchHint;
  runGlobalInstall: () => Promise<void>;
}

/**
 * Detect whether the current process was likely started via npx.
 * @author zgx
 */
export function detectLaunchHint(
  argv: string[] = process.argv,
  execPath: string = process.execPath,
): LaunchHint {
  const joined = `${argv.join(' ')} ${execPath}`.toLowerCase();
  if (joined.includes('npx') || joined.includes('_npx') || joined.includes('@dom-pointer-mcp/server@')) {
    return 'npx';
  }
  if (joined.includes('dom-pointer-mcp')) {
    return 'global';
  }
  return 'unknown';
}

/**
 * Default dependencies for server update checks.
 * @author zgx
 */
export function createDefaultUpdateServiceDeps(): UpdateServiceDeps {
  return {
    getCurrentVersion: () => serverVersion,
    fetchLatestVersion: async () => {
      const response = await fetch(NPM_LATEST_URL, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`npm registry HTTP ${response.status}`);
      }
      const data = await response.json() as { version?: string };
      if (!data.version) {
        throw new Error('npm registry response missing version');
      }
      return data.version;
    },
    detectLaunchHint: () => detectLaunchHint(),
    runGlobalInstall: async () => {
      await execFileAsync('npm', ['install', '-g', `${NPM_PACKAGE_NAME}@latest`], {
        timeout: 120_000,
      });
    },
  };
}

/**
 * Check npm for a newer @dom-pointer-mcp/server, optionally apply a global install.
 * @author zgx
 */
export async function runServerUpdate(
  action: UpdateAction = 'check',
  deps: UpdateServiceDeps = createDefaultUpdateServiceDeps(),
): Promise<ServerUpdateResult> {
  const currentVersion = deps.getCurrentVersion();
  const launchHint = deps.detectLaunchHint();

  let latestVersion: string;
  try {
    latestVersion = await deps.fetchLatestVersion();
  } catch (error) {
    return {
      action,
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      launchHint,
      applied: false,
      message: `Failed to check updates: ${(error as Error).message}`,
    };
  }

  const updateAvailable = isNewerVersion(latestVersion, currentVersion);

  if (action === 'check') {
    if (!updateAvailable) {
      return {
        action,
        currentVersion,
        latestVersion,
        updateAvailable: false,
        launchHint,
        applied: false,
        message: `Server is up to date (${currentVersion}).`,
      };
    }
    return {
      action,
      currentVersion,
      latestVersion,
      updateAvailable: true,
      launchHint,
      applied: false,
      message: `Update available: ${currentVersion} → ${latestVersion}. `
        + 'Run `/pointed update apply` or `dom-pointer-mcp update --apply`.',
    };
  }

  // apply
  if (!updateAvailable) {
    return {
      action,
      currentVersion,
      latestVersion,
      updateAvailable: false,
      launchHint,
      applied: false,
      message: `Server is already up to date (${currentVersion}).`,
    };
  }

  if (launchHint === 'npx') {
    return {
      action,
      currentVersion,
      latestVersion,
      updateAvailable: true,
      launchHint,
      applied: false,
      message: `npx launch detected. Restart the MCP server to pick up ${latestVersion} `
        + '(configured with @latest). No local global install performed.',
    };
  }

  try {
    await deps.runGlobalInstall();
    return {
      action,
      currentVersion,
      latestVersion,
      updateAvailable: true,
      launchHint,
      applied: true,
      message: `Installed ${NPM_PACKAGE_NAME}@${latestVersion} globally. `
        + 'Restart the MCP server to load the new version.',
    };
  } catch (error) {
    return {
      action,
      currentVersion,
      latestVersion,
      updateAvailable: true,
      launchHint,
      applied: false,
      message: `Failed to apply update: ${(error as Error).message}`,
    };
  }
}
