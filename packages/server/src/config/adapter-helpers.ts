import path from 'path';
import fs from 'fs/promises';

export async function writeFileEnsuringDir(
  filePath: string,
  content: string,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

export async function readJsonOrDefault<T>(
  filePath: string,
  fallback: T,
): Promise<T> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export async function readTextOrEmpty(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function deleteFileIfExists(filePath: string): Promise<'deleted' | 'missing'> {
  try {
    await fs.unlink(filePath);
    return 'deleted';
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
    throw e;
  }
}

export async function deleteDirIfExists(dirPath: string): Promise<'deleted' | 'missing'> {
  try {
    await fs.rm(dirPath, { recursive: true, force: false });
    return 'deleted';
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
    throw e;
  }
}

export function removeJsonKey(obj: Record<string, any>, keyPath: string[]): boolean {
  if (keyPath.length === 0) return false;
  let cursor: any = obj;
  for (let i = 0; i < keyPath.length - 1; i += 1) {
    const k = keyPath[i];
    const next = cursor[k];
    if (!next || typeof next !== 'object') return false;
    cursor = next;
  }
  const last = keyPath[keyPath.length - 1];
  if (!(last in cursor)) return false;
  delete cursor[last];
  return true;
}
