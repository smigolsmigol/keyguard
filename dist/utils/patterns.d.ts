export type Severity = 'critical' | 'high' | 'medium';
export interface SecretPattern {
    name: string;
    pattern: RegExp;
    severity: Severity;
}
export declare const SECRET_PATTERNS: SecretPattern[];
export declare const BANNED_FILES: string[];
export declare const MCP_CONFIG_FILES: string[];
