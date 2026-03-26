import type { KeyguardConfig } from './types.js';
export declare function loadConfig(projectRoot: string): KeyguardConfig;
export declare function generateConfig(projectRoot: string): string;
export declare function updateIntegrity(projectRoot: string): void;
