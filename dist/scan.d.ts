import type { PillarResult } from './types.js';
export interface ScanReport {
    results: PillarResult[];
    score: number;
    maxScore: number;
    passed: boolean;
}
export declare function runScan(projectRoot: string): Promise<ScanReport>;
export declare function formatReport(report: ScanReport): string;
