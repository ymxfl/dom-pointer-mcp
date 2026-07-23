import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  SharedState,
  SharedStateData,
  ProcessedPointedSelection,
  SelectionSummary,
} from '../types';
import { BASE_DIR } from '../utils/base-dir';
import logger from '../logger';

export default class SharedStateService {
  static DEFAULT_SHARED_STATE_PATH = path.join(
    BASE_DIR,
    'shared-state.json',
  );

  static SHARED_STATE_PATH = SharedStateService.DEFAULT_SHARED_STATE_PATH;

  static MAX_HISTORY_ITEMS = 20;

  public async saveState(state: SharedState): Promise<void> {
    try {
      const existing = await this.readState();
      const { history, evicted } = this.mergeHistory(state.data, existing);
      const json = JSON.stringify({ data: state.data, history }, null, 2);
      await this.writeState(json);
      await this.deleteScreenshots(evicted);
      logger.debug('Pointed selection saved to shared state file');
    } catch (error) {
      logger.error('Failed to save pointed selection:', error);
      throw error;
    }
  }

  public async getPointedSelection(): Promise<ProcessedPointedSelection | null> {
    const state = await this.readState();
    if (!state) return null;
    return state.data.processedPointedSelection;
  }

  public async getPointedSelectionById(
    selectionId: string,
  ): Promise<ProcessedPointedSelection | null> {
    const state = await this.readState();
    if (!state) return null;
    const entry = this.getHistoryData(state).find((item) => item.selectionId === selectionId);
    return entry?.processedPointedSelection ?? null;
  }

  public async listPointedSelections(): Promise<SelectionSummary[]> {
    const state = await this.readState();
    if (!state) return [];
    return this.getHistoryData(state).map((item) => ({
      selectionId: item.selectionId,
      url: item.processedPointedSelection.url,
      timestamp: item.processedPointedSelection.timestamp,
      userNotePreview: this.preview(item.processedPointedSelection.userNote),
      elementCount: item.processedPointedSelection.elements.length,
      screenshotPath: item.processedPointedSelection.screenshot?.path,
      referenceImageCount: item.processedPointedSelection.referenceImages?.length,
    }));
  }

  public async clearPointedSelections(selectionId?: string): Promise<number> {
    const state = await this.readState();
    if (!state) return 0;

    if (!selectionId) {
      await this.deleteScreenshots(this.getHistoryData(state));
      await fs.unlink(SharedStateService.SHARED_STATE_PATH);
      return this.getHistoryData(state).length;
    }

    const currentHistory = this.getHistoryData(state);
    const nextHistory = currentHistory.filter((item) => item.selectionId !== selectionId);
    const removedHistory = currentHistory.filter((item) => item.selectionId === selectionId);
    const removed = currentHistory.length - nextHistory.length;
    if (removed === 0) return 0;
    await this.deleteScreenshots(removedHistory);

    if (nextHistory.length === 0) {
      await fs.unlink(SharedStateService.SHARED_STATE_PATH);
      return removed;
    }

    await this.writeState(
      JSON.stringify({ data: nextHistory[0], history: nextHistory }, null, 2),
    );
    return removed;
  }

  private mergeHistory(
    data: SharedStateData,
    existing: SharedState | null,
  ): { history: SharedStateData[]; evicted: SharedStateData[] } {
    const existingHistory = existing ? this.getHistoryData(existing) : [];
    const next = [
      data,
      ...existingHistory.filter((item) => item.selectionId !== data.selectionId),
    ];
    return {
      history: next.slice(0, SharedStateService.MAX_HISTORY_ITEMS),
      evicted: next.slice(SharedStateService.MAX_HISTORY_ITEMS),
    };
  }

  private getHistoryData(state: SharedState): SharedStateData[] {
    const history = state.history ?? [state.data];
    return history.filter(Boolean).map((item, index) => {
      if (item.selectionId) return item;
      return {
        ...item,
        selectionId: index === 0 ? 'latest' : `legacy-${index}`,
      };
    });
  }

  private preview(note: string): string {
    const normalized = note.trim().replace(/\s+/gu, ' ');
    if (normalized.length <= 120) return normalized;
    return `${normalized.slice(0, 117)}...`;
  }

  private async deleteScreenshots(items: SharedStateData[]): Promise<void> {
    await Promise.all(items.map(async (item) => {
      const { screenshot, referenceImages } = item.processedPointedSelection;
      const paths = [
        screenshot?.path,
        ...(referenceImages?.map((image) => image.path) ?? []),
      ].filter((p): p is string => Boolean(p));
      await Promise.all(paths.map(async (imagePath) => {
        try {
          await fs.unlink(imagePath);
        } catch {
          // Best effort cleanup.
        }
      }));
    }));
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

  private async writeState(json: string): Promise<void> {
    const statePath = SharedStateService.SHARED_STATE_PATH;
    const stateDir = path.dirname(statePath);
    const temporaryPath = `${statePath}.${process.pid}.${randomUUID()}.tmp`;
    await fs.mkdir(stateDir, { recursive: true, mode: 0o700 });
    try {
      await fs.writeFile(temporaryPath, json, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(temporaryPath, statePath);
    } finally {
      try {
        await fs.unlink(temporaryPath);
      } catch {
        // The atomic rename normally consumes the temporary file.
      }
    }
  }
}
