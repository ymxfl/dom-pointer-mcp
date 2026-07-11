import fs from 'fs/promises';
import { SavedSelectionScreenshot } from '@dom-pointer-mcp/shared/types';
import logger from '../logger';

type SelectionContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

export default async function buildSelectionContent(
  payload: unknown,
  screenshot?: SavedSelectionScreenshot,
): Promise<SelectionContent[]> {
  const content: SelectionContent[] = [{
    type: 'text',
    text: JSON.stringify(payload, null, 2),
  }];

  if (!screenshot?.path) return content;

  try {
    const image = await fs.readFile(screenshot.path);
    content.push({
      type: 'image',
      data: image.toString('base64'),
      mimeType: screenshot.mimeType,
    });
  } catch (error) {
    logger.warn(`Unable to attach selection screenshot: ${(error as Error).message}`);
  }

  return content;
}
