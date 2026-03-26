export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Status = 'pass' | 'fail' | 'warn' | 'skip';
export interface Finding {
    rule: string;
    message: string;
    severity: Severity;
    file?: string;
    line?: number;
    fix?: string;
    autoFixable?: boolean;
}
export interface PillarResult {
    name: string;
    status: Status;
    findings: Finding[];
    summary: string;
}
export interface KeyguardConfig {
    version?: number;
    integrity?: string;
    secrets?: {
        patterns?: string[];
        scan?: string[];
        banned_files?: string[];
    };
    ci?: {
        pin_actions?: boolean;
        require_permissions?: boolean;
        write_allowed?: string[];
    };
    credentials?: {
        vault_provider?: string;
        required_keys?: string[];
    };
}
export interface ScanContext {
    projectRoot: string;
    config: KeyguardConfig;
    files: string[];
}
