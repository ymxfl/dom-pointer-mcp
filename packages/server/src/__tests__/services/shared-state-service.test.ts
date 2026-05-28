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

  describe('saveState', () => {
    it('writes state to file', async () => {
      const state = createSharedState();

      await service.saveState(state);

      const content = await fs.readFile(testPath, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed.data.processedPointedSelection).toEqual(state.data.processedPointedSelection);
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
});
