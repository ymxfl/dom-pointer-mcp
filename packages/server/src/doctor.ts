import fs from 'fs/promises';
import net from 'net';
import logger from './logger';
import SharedStateService from './services/shared-state-service';
import ScreenshotStorageService from './services/screenshot-storage-service';
import { BASE_DIR } from './utils/base-dir';

interface DoctorOptions {
  port: number;
}

function icon(ok: boolean): string {
  return ok ? '✅' : '⚠️';
}

function isSupportedNode(): boolean {
  const major = parseInt(process.versions.node.split('.')[0], 10);
  return major >= 20;
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function countPngFiles(dir: string): Promise<number> {
  try {
    const files = await fs.readdir(dir);
    return files.filter((file) => file.endsWith('.png')).length;
  } catch {
    return 0;
  }
}

export default async function doctor(options: DoctorOptions): Promise<void> {
  const { port } = options;
  const sharedState = new SharedStateService();
  const statePath = SharedStateService.SHARED_STATE_PATH;
  const screenshotDir = ScreenshotStorageService.SCREENSHOT_DIR;
  const stateFileExists = await pathExists(statePath);
  const selections = await sharedState.listPointedSelections();
  const reachable = await checkPort(port);
  const screenshotCount = await countPngFiles(screenshotDir);

  logger.info('DOM Pointer MCP doctor');
  logger.info(`${icon(isSupportedNode())} Node: ${process.version}`);
  logger.info(`${icon(true)} WebSocket port: ${port}`);
  logger.info(`${icon(reachable)} WebSocket reachable: ${reachable ? 'yes' : 'no'}`);
  logger.info(`${icon(stateFileExists)} Shared state: ${stateFileExists ? statePath : 'missing'}`);
  logger.info(`${icon(selections.length > 0)} Stored selections: ${selections.length}`);
  logger.info(`${icon(screenshotCount > 0)} Screenshots: ${screenshotCount} (${screenshotDir})`);

  if (selections[0]) {
    logger.info(`Latest selection: ${selections[0].selectionId}`);
    logger.info(`  URL: ${selections[0].url}`);
    logger.info(`  Elements: ${selections[0].elementCount}`);
    if (selections[0].screenshotPath) {
      logger.info(`  Screenshot: ${selections[0].screenshotPath}`);
    }
  }

  logger.info(`Base dir: ${BASE_DIR}`);
}
