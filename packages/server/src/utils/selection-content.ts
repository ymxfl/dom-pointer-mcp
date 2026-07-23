import fs from 'fs/promises';
import { SavedSelectionScreenshot, SavedReferenceImage } from '@dom-pointer-mcp/shared/types';
import logger from '../logger';

type SelectionContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

async function appendImage(
  content: SelectionContent[],
  imagePath: string,
  mimeType: string,
  label?: string,
): Promise<void> {
  try {
    const image = await fs.readFile(imagePath);
    if (label) content.push({ type: 'text', text: label });
    content.push({
      type: 'image',
      data: image.toString('base64'),
      mimeType,
    });
  } catch (error) {
    logger.warn(`Unable to attach image: ${(error as Error).message}`);
  }
}

export default async function buildSelectionContent(
  payload: unknown,
  screenshot?: SavedSelectionScreenshot,
  referenceImages?: SavedReferenceImage[],
): Promise<SelectionContent[]> {
  const content: SelectionContent[] = [{
    type: 'text',
    text: JSON.stringify(payload, null, 2),
  }];

  if (screenshot?.path) {
    await appendImage(content, screenshot.path, screenshot.mimeType);
  }

  if (referenceImages?.length) {
    for (let i = 0; i < referenceImages.length; i += 1) {
      const image = referenceImages[i];
      const label = `Reference image [${i + 1}] — user-provided reference, see userNote for intent:`;
      // eslint-disable-next-line no-await-in-loop
      await appendImage(content, image.path, image.mimeType, label);
    }
  }

  return content;
}
