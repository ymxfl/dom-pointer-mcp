import fs from 'fs/promises';
import path from 'path';
import {
  RawSelectionScreenshot,
  SavedSelectionScreenshot,
  RawReferenceImage,
  SavedReferenceImage,
  ReferenceImageMimeType,
} from '@dom-pointer-mcp/shared/types';
import { BASE_DIR } from '../utils/base-dir';
import { formatLocalTimestamp } from '../utils/time';

const MIME_EXTENSION: Record<ReferenceImageMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

export default class ScreenshotStorageService {
  static SCREENSHOT_DIR = path.join(BASE_DIR, 'screenshots');

  public async save(
    selectionId: string,
    screenshot?: RawSelectionScreenshot,
  ): Promise<SavedSelectionScreenshot | undefined> {
    if (!screenshot?.dataUrl) return undefined;

    const { buffer } = this.decodeDataUrl(screenshot.dataUrl);
    await this.ensureDir();
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

  public async saveReferenceImages(
    selectionId: string,
    images?: RawReferenceImage[],
  ): Promise<SavedReferenceImage[] | undefined> {
    if (!images?.length) return undefined;

    await this.ensureDir();
    const saved = await Promise.all(
      images.map((image, index) => this.saveReferenceImage(selectionId, image, index)),
    );
    const kept = saved.filter((item): item is SavedReferenceImage => item !== undefined);
    return kept.length > 0 ? kept : undefined;
  }

  private async saveReferenceImage(
    selectionId: string,
    image: RawReferenceImage,
    index: number,
  ): Promise<SavedReferenceImage | undefined> {
    if (!image?.dataUrl) return undefined;

    const { buffer, mimeType } = this.decodeDataUrl(image.dataUrl);
    const ext = MIME_EXTENSION[mimeType];
    const filePath = path.join(
      ScreenshotStorageService.SCREENSHOT_DIR,
      `${selectionId}.ref-${index}.${ext}`,
    );
    await fs.writeFile(filePath, buffer, { mode: 0o600 });

    return {
      path: filePath,
      mimeType,
      width: image.width,
      height: image.height,
      capturedAt: formatLocalTimestamp(image.capturedAt),
    };
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(ScreenshotStorageService.SCREENSHOT_DIR, { recursive: true, mode: 0o700 });
  }

  private decodeDataUrl(dataUrl: string): { buffer: Buffer; mimeType: ReferenceImageMimeType } {
    const match = /^data:(image\/png|image\/jpeg);base64,(.+)$/u.exec(dataUrl);
    if (!match) {
      throw new Error('Unsupported image data URL');
    }
    return {
      buffer: Buffer.from(match[2], 'base64'),
      mimeType: match[1] as ReferenceImageMimeType,
    };
  }
}
