import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'venv',
  '__pycache__',
]);

export function findProjectRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) throw new Error('Not inside a git repository');
    dir = parent;
  }
}

export function listFiles(dir: string, extensions?: string[]): string[] {
  const results: string[] = [];
  walk(dir, extensions, results);
  return results;
}

function walk(dir: string, extensions: string[] | undefined, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && SKIP_DIRS.has(entry.name)) continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, extensions, out);
    } else if (entry.isFile()) {
      if (extensions && extensions.length > 0) {
        const match = extensions.some((ext) => entry.name.endsWith(ext));
        if (!match) continue;
      }
      out.push(full);
    }
  }
}

export function readGitignore(projectRoot: string): string[] {
  const gitignorePath = join(projectRoot, '.gitignore');
  const content = readFile(gitignorePath);
  if (!content) return [];

  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

export function isGitignored(file: string, patterns: string[]): boolean {
  const normalized = file.replace(/\\/g, '/');
  for (const pattern of patterns) {
    if (!pattern) continue;
    // exact directory match: pattern like "dist" or "dist/"
    const cleanPattern = pattern.replace(/\/$/, '');
    if (normalized.includes(`/${cleanPattern}/`) || normalized.endsWith(`/${cleanPattern}`)) {
      return true;
    }
    // glob suffix: *.log, *.pem
    if (pattern.startsWith('*')) {
      const suffix = pattern.slice(1);
      if (normalized.endsWith(suffix)) return true;
    }
    // exact filename match
    const basename = normalized.split('/').pop() ?? '';
    if (basename === pattern) return true;
  }
  return false;
}

export function fileExists(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function readFile(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}
