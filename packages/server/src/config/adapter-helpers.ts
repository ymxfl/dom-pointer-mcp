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
