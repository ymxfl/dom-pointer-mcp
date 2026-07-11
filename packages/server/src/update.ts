import logger from './logger';
import { runServerUpdate } from './services/update-service';

interface UpdateCommandOptions {
  apply?: boolean;
}

/**
 * CLI entry for checking or applying MCP server updates.
 * @author zgx
 */
export default async function updateCommand(options: UpdateCommandOptions): Promise<void> {
  const result = await runServerUpdate(options.apply ? 'apply' : 'check');
  logger.info(result.message);
  logger.info(JSON.stringify({
    currentVersion: result.currentVersion,
    latestVersion: result.latestVersion,
    updateAvailable: result.updateAvailable,
    launchHint: result.launchHint,
    applied: result.applied,
  }, null, 2));

  if (result.latestVersion === null || (options.apply && result.updateAvailable && !result.applied && result.launchHint !== 'npx')) {
    process.exitCode = 1;
  }
}
