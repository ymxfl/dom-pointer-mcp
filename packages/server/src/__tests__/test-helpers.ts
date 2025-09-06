import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { TargetedElement } from '@mcp-pointer/shared/types';

// ES module equivalent of __dirname
// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = path.dirname(__filename);

// Test constants
export const TEST_MCP_POINTER_PORT = 7008;
export const TEST_TEMP_DIR = path.join(__dirname, 'tmp');
export const TEST_SHARED_STATE_PATH = path.join(TEST_TEMP_DIR, 'mcp-pointer-test-shared-state.json');

export async function setupTestDir(): Promise<void> {
  try {
    await fs.mkdir(TEST_TEMP_DIR, { recursive: true });
  } catch {
    // Directory exists, ignore
  }
}

export async function cleanupTestFiles(): Promise<void> {
  try {
    await fs.rm(TEST_TEMP_DIR, { recursive: true, force: true });
  } catch {
    // Directory doesn't exist, ignore
  }
}

export function createMockElement(): TargetedElement {
  return {
    selector: 'div.test-element',
    tagName: 'DIV',
    id: 'test-id',
    classes: ['test-class'],
    innerText: 'Test Element',
    attributes: { 'data-test': 'true' },
    position: {
      x: 100, y: 200, width: 300, height: 50,
    },
    cssProperties: {
      display: 'block',
      position: 'relative',
      fontSize: '16px',
      color: 'rgb(0, 0, 0)',
      backgroundColor: 'rgb(255, 255, 255)',
    },
    timestamp: Date.now(),
    url: 'https://example.com',
    tabId: 123,
  };
}
