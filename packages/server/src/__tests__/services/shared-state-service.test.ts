import fs from 'fs/promises';
import SharedStateService from '../../services/shared-state-service';
import {
  setupTestDir, cleanupTestFiles, createMockElement, TEST_SHARED_STATE_PATH,
} from '../test-helpers';

describe('SharedStateService', () => {
  let service: SharedStateService;

  beforeAll(async () => {
    await setupTestDir();

    // Monkey-patch the constant for testing
    const SharedStateServiceModule = await import('../../services/shared-state-service');
    const SharedStateServiceClass = SharedStateServiceModule.default;

    // Override the static constant
    (SharedStateServiceClass as any).SHARED_STATE_PATH = TEST_SHARED_STATE_PATH;

    service = new SharedStateServiceClass();
  });

  afterAll(async () => {
    await cleanupTestFiles();
  });

  it('should save and load current element', async () => {
    const mockElement = createMockElement();

    await service.saveCurrentElement(mockElement);
    const loadedElement = await service.getCurrentElement();

    expect(loadedElement).toBeTruthy();
    expect(loadedElement!.selector).toBe(mockElement.selector);
    expect(loadedElement!.tagName).toBe(mockElement.tagName);
    expect(loadedElement!.id).toBe(mockElement.id);
    expect(loadedElement!.classes).toEqual(mockElement.classes);
    expect(loadedElement!.innerText).toBe(mockElement.innerText);
    expect(loadedElement!.attributes).toEqual(mockElement.attributes);
    expect(loadedElement!.position).toEqual(mockElement.position);
    expect(loadedElement!.cssProperties).toEqual(mockElement.cssProperties);
    expect(loadedElement!.url).toBe(mockElement.url);
    expect(loadedElement!.tabId).toBe(mockElement.tabId);
  });

  it('should handle null element', async () => {
    await service.saveCurrentElement(null);
    const loadedElement = await service.getCurrentElement();

    expect(loadedElement).toBeNull();
  });

  it('should return null for missing file', async () => {
    // Delete the file if it exists
    try {
      await fs.unlink(TEST_SHARED_STATE_PATH);
    } catch {
      // File doesn't exist, which is fine
    }

    const loadedElement = await service.getCurrentElement();
    expect(loadedElement).toBeNull();
  });

  it('should handle corrupted file gracefully', async () => {
    // Write invalid JSON to the file
    await fs.writeFile(TEST_SHARED_STATE_PATH, 'invalid json content');

    const loadedElement = await service.getCurrentElement();
    expect(loadedElement).toBeNull();
  });

  it('should save element over corrupted file', async () => {
    // Write invalid JSON to the file
    await fs.writeFile(TEST_SHARED_STATE_PATH, 'invalid json content');

    const mockElement = createMockElement();
    await service.saveCurrentElement(mockElement);

    const loadedElement = await service.getCurrentElement();
    expect(loadedElement).toBeTruthy();
    expect(loadedElement!.selector).toBe(mockElement.selector);
  });

  it('should overwrite previous element', async () => {
    const firstElement = createMockElement();
    firstElement.selector = 'div.first-element';

    const secondElement = createMockElement();
    secondElement.selector = 'div.second-element';

    await service.saveCurrentElement(firstElement);
    await service.saveCurrentElement(secondElement);

    const loadedElement = await service.getCurrentElement();
    expect(loadedElement).toBeTruthy();
    expect(loadedElement!.selector).toBe('div.second-element');
  });
});
