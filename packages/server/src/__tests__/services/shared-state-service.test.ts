import {
  describe, it, before, after,
} from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import SharedStateService from '../../services/shared-state-service';
import {
  setupTestDir, cleanupTestFiles, createMockElement, TEST_SHARED_STATE_PATH,
} from '../test-helpers';

// Override the shared state path for testing

describe('SharedStateService', () => {
  let service: SharedStateService;

  before(async () => {
    await setupTestDir();

    // Monkey-patch the constant for testing
    const SharedStateServiceModule = await import('../../services/shared-state-service');
    (SharedStateServiceModule.default as any).prototype.constructor = function testConstructor() {
      // Use test path instead of default
      this.filePath = TEST_SHARED_STATE_PATH;
    };

    service = new SharedStateService();
  });

  after(async () => {
    await cleanupTestFiles();
  });

  it('should save and load current element', async () => {
    const mockElement = createMockElement();

    await service.saveCurrentElement(mockElement);
    const loaded = await service.getCurrentElement();

    assert.deepStrictEqual(loaded, mockElement);
  });

  it('should handle null element', async () => {
    await service.saveCurrentElement(null);
    const loaded = await service.getCurrentElement();

    assert.strictEqual(loaded, null);
  });

  it('should return null for missing file', async () => {
    await cleanupTestFiles();
    await setupTestDir();

    const loaded = await service.getCurrentElement();

    assert.strictEqual(loaded, null);
  });

  it('should handle corrupted file gracefully', async () => {
    // Write corrupted data to the file
    await fs.writeFile(TEST_SHARED_STATE_PATH, 'not json at all', 'utf8');

    const loaded = await service.getCurrentElement();

    assert.strictEqual(loaded, null);
  });

  it('should save element over corrupted file', async () => {
    // First create a corrupted file
    await fs.writeFile(TEST_SHARED_STATE_PATH, 'corrupted content', 'utf8');

    // Save a new element over it
    const mockElement = createMockElement();
    await service.saveCurrentElement(mockElement);

    // Should be able to load the new element
    const loaded = await service.getCurrentElement();

    assert.deepStrictEqual(loaded, mockElement);
  });

  it('should overwrite previous element', async () => {
    const firstElement = createMockElement();
    const secondElement = { ...createMockElement(), id: 'second-element' };

    await service.saveCurrentElement(firstElement);
    await service.saveCurrentElement(secondElement);

    const loaded = await service.getCurrentElement();

    assert.deepStrictEqual(loaded, secondElement);
  });
});
