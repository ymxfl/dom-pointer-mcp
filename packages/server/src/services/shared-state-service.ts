import fs from 'fs/promises';
import { type TargetedElement } from '@mcp-pointer/shared/types';
import logger from '../logger';

// Shared state constants
const SHARED_STATE_FILE_PATH = '/tmp/mcp-pointer-shared-state.json';

export default class SharedStateService {
  public async saveCurrentElement(element: TargetedElement | null): Promise<void> {
    try {
      const json = JSON.stringify(element, null, 2);
      await fs.writeFile(SHARED_STATE_FILE_PATH, json, 'utf8');
      logger.debug('Current element saved to shared state file');
    } catch (error) {
      logger.error('Failed to save current element:', error);
    }
  }

  public async getCurrentElement(): Promise<TargetedElement | null> {
    try {
      const json = await fs.readFile(SHARED_STATE_FILE_PATH, 'utf8');
      return JSON.parse(json);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('Shared state file does not exist');
        return null;
      }
      logger.error('Failed to load current element:', error);
      return null;
    }
  }
}
