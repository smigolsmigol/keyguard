import { relative } from 'node:path';
import { loadConfig } from './config.js';
import { listFiles, readGitignore, isGitignored } from './utils/git.js';
const SCORE_MAP = {
    pass: 1,
    warn: 0.5,
    fail: 0,
    skip: 0,
};
export async function runScan(projectRoot) {
    const config = loadConfig(projectRoot);
    const gitignorePatterns = readGitignore(projectRoot);
    const allFiles = listFiles(projectRoot).filter((f) => !isGitignored(relative(projectRoot, f), gitignorePatterns));
    const ctx = { projectRoot, config, files: allFiles };
    const pillars = await loadPillars();
    const results = [];
    for (const pillar of pillars) {
        try {
            const result = await pillar(ctx);
            results.push(result);
        }
        catch (err) {
            results.push({
                name: 'unknown',
                status: 'skip',
                findings: [],
                summary: `Pillar threw: ${err instanceof Error ? err.message : String(err)}`,
            });
        }
    }
    const score = results.reduce((acc, r) => acc + SCORE_MAP[r.status], 0);
    const maxScore = results.length;
    const passed = results.every((r) => r.status !== 'fail');
    return { results, score, maxScore, passed };
}
async function loadPillars() {
    // pillars directory might not have any modules yet, return empty
    // once pillar files exist they'll be imported here
    const loaded = [];
    const pillarModules = [
        'secrets',
        'supply-chain',
        'credentials',
        'config-integrity',
        'health',
    ];
    for (const name of pillarModules) {
        try {
            const mod = await import(`./pillars/${name}.js`);
            if (typeof mod.scan === 'function') {
                loaded.push(mod.scan);
            }
        }
        catch {
            // pillar not yet implemented, skip
            loaded.push(() => ({
                name,
                status: 'skip',
                findings: [],
                summary: 'Not yet implemented',
            }));
        }
    }
    return loaded;
}
// ansi helpers
const c = {
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};
const STATUS_ICON = {
    pass: c.green('\u2713'),
    fail: c.red('\u2717'),
    warn: c.yellow('\u26A0'),
    skip: c.dim('-'),
};
const STATUS_LABEL = {
    pass: c.green('PASS'),
    fail: c.red('FAIL'),
    warn: c.yellow('WARN'),
    skip: c.dim('SKIP'),
};
export function formatReport(report) {
    const lines = [];
    for (const result of report.results) {
        const icon = STATUS_ICON[result.status];
        const label = STATUS_LABEL[result.status];
        lines.push(`  ${icon} ${c.bold(result.name)}  ${label}`);
        lines.push(`    ${result.summary}`);
        for (const f of result.findings) {
            const sev = f.severity === 'critical' || f.severity === 'high' ? c.red(f.severity) : c.yellow(f.severity);
            const location = f.file ? c.dim(f.file + (f.line ? `:${f.line}` : '')) : '';
            const fixNote = f.autoFixable ? c.cyan(' (auto-fixable)') : '';
            lines.push(`      [${sev}] ${c.bold(f.rule)}: ${f.message} ${location}${fixNote}`);
        }
        lines.push('');
    }
    const scoreColor = report.passed ? c.green : c.red;
    lines.push(`  Score: ${scoreColor(`${report.score}/${report.maxScore}`)}`);
    if (report.passed) {
        lines.push(`  ${c.green('All checks passed.')}`);
    }
    else {
        const failures = report.results.filter((r) => r.status === 'fail').length;
        lines.push(`  ${c.red(`${failures} pillar${failures === 1 ? '' : 's'} failed.`)} Run ${c.bold('keyguard fix')} to auto-fix.`);
    }
    lines.push('');
    return lines.join('\n');
}
//# sourceMappingURL=scan.js.map