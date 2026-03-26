export interface FixResult {
    fixed: string[];
    manual: string[];
}
export declare function runFix(projectRoot: string): Promise<FixResult>;
export declare function formatFix(result: FixResult): string;
