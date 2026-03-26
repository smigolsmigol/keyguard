import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'venv',
  '.venv',
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

function gitignorePatternToRegex(pattern: string): RegExp {
  // strip trailing slash (marks directory-only, we don't distinguish)
  let p = pattern.replace(/\/$/, '');
  const anchored = p.startsWith('/');
  if (anchored) p = p.slice(1);

  // escape regex special chars except our glob chars
  let regex = '';
  let i = 0;
  while (i < p.length) {
    const ch = p[i];
    if (ch === '*' && p[i + 1] === '*') {
      // ** matches everything including path separators
      if (p[i + 2] === '/') {
        regex += '(?:.*/)?';
        i += 3;
      } else {
        regex += '.*';
        i += 2;
      }
    } else if (ch === '*') {
      regex += '[^/]*';
      i++;
    } else if (ch === '?') {
      regex += '[^/]';
      i++;
    } else if ('.+^${}()|[]\\'.includes(ch)) {
      regex += '\\' + ch;
      i++;
    } else {
      regex += ch;
      i++;
    }
  }

  if (anchored) {
    return new RegExp(`^${regex}(?:/|$)`);
  }
  // unanchored: match basename or any path component
  return new RegExp(`(?:^|/)${regex}(?:/|$)`);
}

export function isGitignored(file: string, patterns: string[]): boolean {
  const normalized = file.replace(/\\/g, '/');
  for (const pattern of patterns) {
    if (!pattern) continue;
    const re = gitignorePatternToRegex(pattern);
    if (re.test(normalized)) return true;
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
