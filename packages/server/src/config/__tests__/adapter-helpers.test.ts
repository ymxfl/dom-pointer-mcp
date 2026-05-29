import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import {
  fileExists,
  deleteFileIfExists,
  removeJsonKey,
} from '../adapter-helpers';

describe('fileExists', () => {
  it('returns true when file exists', async () => {
    const p = path.join(os.tmpdir(), `mcp-pointer-${Date.now()}-exists.tmp`);
    await fs.writeFile(p, 'x', 'utf8');
    try {
      await expect(fileExists(p)).resolves.toBe(true);
    } finally {
      await fs.unlink(p).catch(() => {});
    }
  });

  it('returns false when file does not exist', async () => {
    const p = path.join(os.tmpdir(), `mcp-pointer-${Date.now()}-missing.tmp`);
    await expect(fileExists(p)).resolves.toBe(false);
  });
});

describe('deleteFileIfExists', () => {
  it('returns "deleted" when the file existed', async () => {
    const p = path.join(os.tmpdir(), `mcp-pointer-${Date.now()}-del.tmp`);
    await fs.writeFile(p, 'x', 'utf8');
    await expect(deleteFileIfExists(p)).resolves.toBe('deleted');
    await expect(fileExists(p)).resolves.toBe(false);
  });

  it('returns "missing" when the file was absent', async () => {
    const p = path.join(os.tmpdir(), `mcp-pointer-${Date.now()}-nope.tmp`);
    await expect(deleteFileIfExists(p)).resolves.toBe('missing');
  });
});

describe('removeJsonKey', () => {
  it('removes a top-level key path', () => {
    const obj: any = { a: 1, b: 2 };
    expect(removeJsonKey(obj, ['a'])).toBe(true);
    expect(obj).toEqual({ b: 2 });
  });

  it('removes a nested key path', () => {
    const obj: any = { mcpServers: { pointer: { x: 1 }, other: { y: 2 } } };
    expect(removeJsonKey(obj, ['mcpServers', 'pointer'])).toBe(true);
    expect(obj).toEqual({ mcpServers: { other: { y: 2 } } });
  });

  it('returns false when the key is absent', () => {
    const obj: any = { mcpServers: { other: {} } };
    expect(removeJsonKey(obj, ['mcpServers', 'pointer'])).toBe(false);
    expect(obj).toEqual({ mcpServers: { other: {} } });
  });

  it('returns false when an intermediate key is missing or not an object', () => {
    const obj: any = { a: 'string' };
    expect(removeJsonKey(obj, ['a', 'b'])).toBe(false);
    expect(removeJsonKey({}, ['x', 'y'])).toBe(false);
  });
});
