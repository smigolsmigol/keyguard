import { createHash } from 'node:crypto';

export function computeHash(content: string): string {
  return createHash('sha256').update(content.replace(/\r\n/g, '\n')).digest('hex');
}

/** Hash a .keyguard.yml file, stripping the `integrity:` line so the hash doesn't include itself. */
export function computeConfigHash(fileContent: string): string {
  const stripped = fileContent
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('integrity:'))
    .join('\n');
  return computeHash(stripped);
}
