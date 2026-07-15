import fs from 'fs/promises';
import path from 'path';
import {
  RawSelectionScreenshot,
  SavedSelectionScreenshot,
} from '@dom-pointer-mcp/shared/types';
import { BASE_DIR } from '../utils/base-dir';
import { formatLocalTimestamp } from '../utils/time';

export default class ScreenshotStorageService {
  static SCREENSHOT_DIR = path.join(BASE_DIR, 'screenshots');

  public async save(
    selectionId: string,
    screenshot?: RawSelectionScreenshot,
  ): Promise<SavedSelectionScreenshot | undefined> {
    if (!screenshot?.dataUrl) return undefined;

    const buffer = this.decodeDataUrl(screenshot.dataUrl);
    await fs.mkdir(ScreenshotStorageService.SCREENSHOT_DIR, { recursive: true, mode: 0o700 });
    const filePath = path.join(ScreenshotStorageService.SCREENSHOT_DIR, `${selectionId}.png`);
    await fs.writeFile(filePath, buffer, { mode: 0o600 });

    return {
      path: filePath,
      mimeType: screenshot.mimeType,
      width: screenshot.width,
      height: screenshot.height,
      bounds: screenshot.bounds,
      capturedAt: formatLocalTimestamp(screenshot.capturedAt),
    };
  }

  private decodeDataUrl(dataUrl: string): Buffer {
    const match = /^data:image\/png;base64,(.+)$/u.exec(dataUrl);
    if (!match) {
      throw new Error('Unsupported screenshot data URL');
    }
    return Buffer.from(match[1], 'base64');
  }
}
