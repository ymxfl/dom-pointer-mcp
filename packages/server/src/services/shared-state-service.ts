import fs from 'fs/promises';
import { SharedState, ProcessedPointedSelection } from '../types';
import logger from '../logger';

export default class SharedStateService {
  static SHARED_STATE_PATH = '/tmp/dom-pointer-mcp-shared-state.json';

  public async saveState(state: SharedState): Promise<void> {
    try {
      const json = JSON.stringify(state, null, 2);
      await fs.writeFile(SharedStateService.SHARED_STATE_PATH, json, 'utf8');
      logger.debug('Pointed selection saved to shared state file');
    } catch (error) {
      logger.error('Failed to save pointed selection:', error);
    }
  }

  public async getPointedSelection(): Promise<ProcessedPointedSelection | null> {
    const state = await this.readState();
    if (!state) return null;
    return state.data.processedPointedSelection;
  }

  private async readState(): Promise<SharedState | null> {
    try {
      const json = await fs.readFile(SharedStateService.SHARED_STATE_PATH, 'utf8');
      return JSON.parse(json);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('Shared state file does not exist');
        return null;
      }
      logger.error('Failed to read state file:', error);
      return null;
    }
  }
}
