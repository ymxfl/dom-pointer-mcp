import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import buildSelectionContent from '../../utils/selection-content';

jest.mock('../../logger', () => ({
  warn: jest.fn(),
}));

describe('buildSelectionContent', () => {
  it('attaches an existing screenshot as MCP image content', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dom-pointer-image-'));
    const imagePath = path.join(dir, 'selection.png');
    await fs.writeFile(imagePath, Buffer.from('png-bytes'));

    try {
      const content = await buildSelectionContent(
        { selectionId: 'sel_1' },
        {
          path: imagePath,
          mimeType: 'image/png',
          width: 1,
          height: 1,
          capturedAt: '2026-07-11T10:00:00+08:00',
        },
      );

      expect(content).toEqual([
        { type: 'text', text: JSON.stringify({ selectionId: 'sel_1' }, null, 2) },
        { type: 'image', data: Buffer.from('png-bytes').toString('base64'), mimeType: 'image/png' },
      ]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('returns text content when no screenshot exists', async () => {
    await expect(buildSelectionContent({ selectionId: 'sel_1' })).resolves.toEqual([
      { type: 'text', text: JSON.stringify({ selectionId: 'sel_1' }, null, 2) },
    ]);
  });
});
