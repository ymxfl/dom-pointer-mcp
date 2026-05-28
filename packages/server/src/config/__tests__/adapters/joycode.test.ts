import path from 'path';
import os from 'os';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
}));

import fs from 'fs/promises';
import { joycodeAdapter } from '../../adapters/joycode';

const mockedWriteFile = fs.writeFile as jest.Mock;
const mockedReadFile = fs.readFile as jest.Mock;

beforeEach(() => {
  mockedWriteFile.mockClear();
  mockedReadFile.mockClear();
  mockedReadFile.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
});

describe('joycodeAdapter', () => {
  it('registerMcp user writes ~/.joycode/joycode-mcp.json', async () => {
    const result = await joycodeAdapter.registerMcp('user', 7007);
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(os.homedir(), '.joycode', 'joycode-mcp.json'));
  });

  it('registerMcp project writes <cwd>/.joycode/mcp.json', async () => {
    const result = await joycodeAdapter.registerMcp('project', 7007);
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(process.cwd(), '.joycode', 'mcp.json'));
  });

  it('installTrigger project merges into prompt.json keeping other entries', async () => {
    mockedReadFile.mockResolvedValueOnce(JSON.stringify([
      { name: 'someOtherCommand', label: 'Other', prompt: 'x' },
      { name: 'pointerOld', label: 'Old', prompt: 'stale' },
    ]));
    const result = await joycodeAdapter.installTrigger('project');
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(process.cwd(), '.joycode', 'prompt.json'));
    const written = JSON.parse(mockedWriteFile.mock.calls[0][1]);
    expect(Array.isArray(written)).toBe(true);
    const names = written.map((e: any) => e.name);
    expect(names).toContain('someOtherCommand');
    expect(names).not.toContain('pointerOld');
    expect(names).toContain('pointerPointed');
  });

  it('installTrigger user degrades to project scope', async () => {
    const result = await joycodeAdapter.installTrigger('user');
    expect(result.status).toBe('degraded');
    expect(result.scope).toBe('project');
    expect(result.message).toMatch(/only supports project-level/i);
  });
});
