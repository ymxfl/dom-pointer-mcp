import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import SharedStateService from '../../services/shared-state-service';
import { createSharedState } from '../factories/shared-state-factory';

jest.mock('../../logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
}));

describe('SharedStateService', () => {
  const originalDefaultPath = SharedStateService.DEFAULT_SHARED_STATE_PATH;
  const originalStatePath = SharedStateService.SHARED_STATE_PATH;
  let service: SharedStateService;
  let testPath: string;

  beforeEach(async () => {
    testPath = path.join(os.tmpdir(), `test-${Date.now()}.json`);
    (SharedStateService as any).SHARED_STATE_PATH = testPath;
    service = new SharedStateService();
  });

  afterEach(async () => {
    try {
      await fs.unlink(testPath);
    } catch {
      // ignore
    }
  });

  afterAll(() => {
    SharedStateService.DEFAULT_SHARED_STATE_PATH = originalDefaultPath;
    SharedStateService.SHARED_STATE_PATH = originalStatePath;
  });

  it('uses the platform temp directory for the default state path', () => {
    expect(SharedStateService.DEFAULT_SHARED_STATE_PATH).toBe(
      path.join(os.tmpdir(), 'dom-pointer-mcp', 'shared-state.json'),
    );
  });

  describe('saveState', () => {
    it('writes state to file', async () => {
      const state = createSharedState();

      await service.saveState(state);

      const content = await fs.readFile(testPath, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed.data.processedPointedSelection).toEqual(state.data.processedPointedSelection);
      expect(parsed.history).toHaveLength(1);
    });

    it('keeps latest state and prepends history', async () => {
      const first = createSharedState(
        {},
        {},
        { selectionId: 'sel_first', userNote: 'first note' },
      );
      const second = createSharedState(
        {},
        {},
        { selectionId: 'sel_second', userNote: 'second note' },
      );

      await service.saveState(first);
      await service.saveState(second);

      const content = await fs.readFile(testPath, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed.data.selectionId).toBe('sel_second');
      expect(parsed.history.map((item: any) => item.selectionId)).toEqual([
        'sel_second',
        'sel_first',
      ]);
    });

    it('deletes screenshot files for selections evicted by the history cap', async () => {
      const originalMaxHistoryItems = SharedStateService.MAX_HISTORY_ITEMS;
      const screenshotDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dom-pointer-test-'));
      const evictedScreenshotPath = path.join(screenshotDir, 'evicted.png');
      await fs.writeFile(evictedScreenshotPath, 'png');
      (SharedStateService as any).MAX_HISTORY_ITEMS = 2;

      try {
        const first = createSharedState(
          {},
          {},
          { selectionId: 'sel_first', userNote: 'first note' },
        );
        first.data.processedPointedSelection.screenshot = {
          path: evictedScreenshotPath,
          mimeType: 'image/png',
          width: 1,
          height: 1,
          capturedAt: first.data.processedPointedSelection.timestamp,
        };

        await service.saveState(first);
        await service.saveState(createSharedState(
          {},
          {},
          { selectionId: 'sel_second', userNote: 'second note' },
        ));
        await service.saveState(createSharedState(
          {},
          {},
          { selectionId: 'sel_third', userNote: 'third note' },
        ));

        await expect(fs.access(evictedScreenshotPath)).rejects.toMatchObject({
          code: 'ENOENT',
        });

        const content = await fs.readFile(testPath, 'utf8');
        const parsed = JSON.parse(content);
        expect(parsed.history.map((item: any) => item.selectionId)).toEqual([
          'sel_third',
          'sel_second',
        ]);
      } finally {
        (SharedStateService as any).MAX_HISTORY_ITEMS = originalMaxHistoryItems;
        await fs.rm(screenshotDir, { recursive: true, force: true });
      }
    });

    it('overwrites corrupted file', async () => {
      await fs.writeFile(testPath, 'invalid json');
      const state = createSharedState();

      await service.saveState(state);

      const content = await fs.readFile(testPath, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed.data.processedPointedSelection).toEqual(state.data.processedPointedSelection);
    });
  });

  describe('getPointedSelection', () => {
    it('returns processed selection from state', async () => {
      const state = createSharedState();
      await fs.writeFile(testPath, JSON.stringify(state));

      const result = await service.getPointedSelection();

      expect(result).toEqual(state.data.processedPointedSelection);
      expect(result?.userNote).toBe('test note');
      expect(result?.elements).toHaveLength(1);
      expect(result?.elements[0].tagName).toBe('div');
    });

    it('returns null for invalid json', async () => {
      await fs.writeFile(testPath, 'invalid json');

      const result = await service.getPointedSelection();

      expect(result).toBeNull();
    });

    it('returns null when file does not exist', async () => {
      const result = await service.getPointedSelection();

      expect(result).toBeNull();
    });
  });

  describe('listPointedSelections', () => {
    it('returns recent selection summaries', async () => {
      const first = createSharedState(
        {},
        {},
        { selectionId: 'sel_first', userNote: 'first note' },
      );
      const second = createSharedState(
        {},
        {},
        { selectionId: 'sel_second', userNote: 'second note' },
      );
      await service.saveState(first);
      await service.saveState(second);

      const result = await service.listPointedSelections();

      expect(result).toEqual([
        expect.objectContaining({
          selectionId: 'sel_second',
          userNotePreview: 'second note',
          elementCount: 1,
        }),
        expect.objectContaining({
          selectionId: 'sel_first',
          userNotePreview: 'first note',
          elementCount: 1,
        }),
      ]);
    });
  });

  describe('getPointedSelectionById', () => {
    it('returns a historical selection by id', async () => {
      const first = createSharedState(
        {},
        {},
        { selectionId: 'sel_first', userNote: 'first note' },
      );
      const second = createSharedState(
        {},
        {},
        { selectionId: 'sel_second', userNote: 'second note' },
      );
      await service.saveState(first);
      await service.saveState(second);

      const result = await service.getPointedSelectionById('sel_first');

      expect(result?.userNote).toBe('first note');
    });
  });

  describe('clearPointedSelections', () => {
    it('clears one selection by id', async () => {
      const first = createSharedState(
        {},
        {},
        { selectionId: 'sel_first', userNote: 'first note' },
      );
      const second = createSharedState(
        {},
        {},
        { selectionId: 'sel_second', userNote: 'second note' },
      );
      await service.saveState(first);
      await service.saveState(second);

      const removed = await service.clearPointedSelections('sel_second');
      const result = await service.listPointedSelections();

      expect(removed).toBe(1);
      expect(result).toHaveLength(1);
      expect(result[0].selectionId).toBe('sel_first');
    });
  });
});
