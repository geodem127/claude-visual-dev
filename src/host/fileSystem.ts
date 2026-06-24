import * as fs from 'fs/promises';
import * as path from 'path';

export async function readFile(absPath: string): Promise<string> {
  return fs.readFile(absPath, 'utf-8');
}

export async function writeFile(absPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, 'utf-8');
}

export async function listDir(absPath: string): Promise<string[]> {
  const entries = await fs.readdir(absPath, { withFileTypes: true });
  return entries.map(e => (e.isDirectory() ? e.name + '/' : e.name));
}
