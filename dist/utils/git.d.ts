export declare function findProjectRoot(): string;
export declare function listFiles(dir: string, extensions?: string[]): string[];
export declare function readGitignore(projectRoot: string): string[];
export declare function isGitignored(file: string, patterns: string[]): boolean;
export declare function fileExists(path: string): boolean;
export declare function readFile(path: string): string | null;
