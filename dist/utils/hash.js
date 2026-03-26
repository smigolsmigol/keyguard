import { createHash } from 'node:crypto';
export function computeHash(content) {
    return createHash('sha256').update(content).digest('hex');
}
/** Hash a .keyguard.yml file, stripping the `integrity:` line so the hash doesn't include itself. */
export function computeConfigHash(fileContent) {
    const stripped = fileContent
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('integrity:'))
        .join('\n');
    return computeHash(stripped);
}
//# sourceMappingURL=hash.js.map