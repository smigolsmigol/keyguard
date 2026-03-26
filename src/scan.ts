import { relative } from 'node:path';
import type { PillarResult, ScanContext, Status } from './types.js';
import { loadConfig } from './config.js';
import { listFiles, readGitignore, isGitignored } from './utils/git.js';

export interface ScanReport {
  results: PillarResult[];
  score: number;
  maxScore: number;
  passed: boolean;
}

const SCORE_MAP: Record<Status, number> = {
  pass: 1,
  warn: 0.5,
  fail: 0,
  skip: 0,
};

export async function runScan(projectRoot: string): Promise<ScanReport> {
  const config = loadConfig(projectRoot);
  const gitignorePatterns = readGitignore(projectRoot);
  const allFiles = listFiles(projectRoot).filter((f) => !isGitignored(relative(projectRoot, f), gitignorePatterns));

  const ctx: ScanContext = { projectRoot, config, files: allFiles };

  const pillars = await loadPillars();
  const results: PillarResult[] = [];

  for (const pillar of pillars) {
    try {
      const result = await pillar(ctx);
      results.push(result);
    } catch (err) {
      results.push({
        name: 'unknown',
        status: 'skip',
        findings: [],
        summary: `Pillar threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const nonSkipped = results.filter((r) => r.status !== 'skip');
  const score = nonSkipped.reduce((acc, r) => acc + SCORE_MAP[r.status], 0);
  const maxScore = nonSkipped.length;
  const passed = results.every((r) => r.status !== 'fail');

  return { results, score, maxScore, passed };
}

type PillarFn = (ctx: ScanContext) => Promise<PillarResult> | PillarResult;

async function loadPillars(): Promise<PillarFn[]> {
  // pillars directory might not have any modules yet, return empty
  // once pillar files exist they'll be imported here
  const loaded: PillarFn[] = [];

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
    } catch {
      // pillar not yet implemented, skip
      loaded.push(() => ({
        name,
        status: 'skip' as Status,
        findings: [],
        summary: 'Not yet implemented',
      }));
    }
  }

  return loaded;
}

// ansi helpers
const NO_COLOR = !!process.env.NO_COLOR || process.argv.includes('--no-color');
const ansi = (code: string) => NO_COLOR ? (s: string) => s : (s: string) => `\x1b[${code}m${s}\x1b[0m`;
const c = {
  green: ansi('32'),
  red: ansi('31'),
  yellow: ansi('33'),
  dim: ansi('2'),
  bold: ansi('1'),
  cyan: ansi('36'),
};

const STATUS_ICON: Record<Status, string> = {
  pass: c.green('\u2713'),
  fail: c.red('\u2717'),
  warn: c.yellow('\u26A0'),
  skip: c.dim('-'),
};

const STATUS_LABEL: Record<Status, string> = {
  pass: c.green('PASS'),
  fail: c.red('FAIL'),
  warn: c.yellow('WARN'),
  skip: c.dim('SKIP'),
};

export function formatReport(report: ScanReport): string {
  const lines: string[] = [];

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
  } else {
    const failures = report.results.filter((r) => r.status === 'fail').length;
    lines.push(`  ${c.red(`${failures} pillar${failures === 1 ? '' : 's'} failed.`)} Run ${c.bold('keyguard fix')} to auto-fix.`);
  }

  lines.push('');
  return lines.join('\n');
}
