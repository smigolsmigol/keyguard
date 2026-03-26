export declare function computeHash(content: string): string;
/** Hash a .keyguard.yml file, stripping the `integrity:` line so the hash doesn't include itself. */
export declare function computeConfigHash(fileContent: string): string;
