import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Finding, PillarResult, ScanContext } from '../types.js';

const GITIGNORE_PATTERNS = ['.env', '.env.*', '*.key', '*.pem', '*.p12', '.npmrc', '.pypirc'];

function readLines(filePath: string): string[] {
  try {
    return readFileSync(filePath, 'utf-8').split('\n').map((l) => l.trim());
  } catch {
    return [];
  }
}

function patternCovered(pattern: string, lines: string[]): boolean {
  for (const line of lines) {
    if (line === '' || line.startsWith('#')) continue;
    if (line === pattern) return true;
    // .env.* covers .env.local, .env.production, etc
    if (pattern === '.env.*' && (line === '.env*' || line === '.env.*')) return true;
    // *.key covers all .key files
    if (pattern.startsWith('*.') && line === pattern) return true;
  }
  return false;
}

function checkGitignore(projectRoot: string): Finding[] {
  const findings: Finding[] = [];
  const gitignorePath = join(projectRoot, '.gitignore');

  if (!existsSync(gitignorePath)) {
    findings.push({
      rule: 'no-gitignore',
      message: 'No .gitignore file found',
      severity: 'critical',
      fix: 'Create a .gitignore with secret file patterns (.env, *.key, *.pem, etc.)',
      autoFixable: true,
    });
    return findings;
  }

  const lines = readLines(gitignorePath);

  for (const pattern of GITIGNORE_PATTERNS) {
    if (!patternCovered(pattern, lines)) {
      findings.push({
        rule: 'gitignore-missing-pattern',
        message: `"${pattern}" not found in .gitignore`,
        severity: pattern === '.env' ? 'critical' : 'high',
        file: '.gitignore',
        fix: `Add "${pattern}" to .gitignore`,
        autoFixable: true,
      });
    }
  }

  return findings;
}

function checkAiContextExclusion(projectRoot: string): Finding[] {
  const findings: Finding[] = [];
  const envPatterns = ['.env', '.env.*', '*.key', '*.pem'];

  // .cursorignore
  const cursorignorePath = join(projectRoot, '.cursorignore');
  if (existsSync(cursorignorePath)) {
    const lines = readLines(cursorignorePath);
    for (const pattern of envPatterns) {
      if (!patternCovered(pattern, lines)) {
        findings.push({
          rule: 'cursorignore-missing-pattern',
          message: `"${pattern}" not in .cursorignore - Cursor may index secrets`,
          severity: 'medium',
          file: '.cursorignore',
          fix: `Add "${pattern}" to .cursorignore`,
          autoFixable: true,
        });
      }
    }
  } else {
    findings.push({
      rule: 'no-cursorignore',
      message: 'No .cursorignore found - AI coding tools may index secret files',
      severity: 'medium',
      fix: 'Create .cursorignore with .env and credential patterns',
      autoFixable: true,
    });
  }

  // .claudeignore
  const claudeignorePath = join(projectRoot, '.claudeignore');
  if (!existsSync(claudeignorePath)) {
    findings.push({
      rule: 'no-claudeignore',
      message: 'No .claudeignore found - Claude Code may read secret files',
      severity: 'medium',
      fix: 'Create .claudeignore with .env and credential patterns',
      autoFixable: true,
    });
  }

  return findings;
}

function checkVaultConfig(ctx: ScanContext): Finding[] {
  const findings: Finding[] = [];
  const vaultProvider = ctx.config.credentials?.vault_provider;

  if (!vaultProvider) {
    findings.push({
      rule: 'no-vault-config',
      message: 'No vault provider configured in .keyguard.yml',
      severity: 'info',
      fix: 'Configure credentials.vault_provider in .keyguard.yml (e.g., "1password", "doppler", "infisical")',
    });
  }

  return findings;
}

export async function scan(ctx: ScanContext): Promise<PillarResult> {
  const findings: Finding[] = [];

  findings.push(...checkGitignore(ctx.projectRoot));
  findings.push(...checkAiContextExclusion(ctx.projectRoot));
  findings.push(...checkVaultConfig(ctx));

  const hasCritical = findings.some((f) => f.severity === 'critical');
  const hasHighOrMedium = findings.some(
    (f) => f.severity === 'high' || f.severity === 'medium',
  );

  let status: 'pass' | 'fail' | 'warn';
  if (hasCritical) {
    status = 'fail';
  } else if (hasHighOrMedium) {
    status = 'warn';
  } else {
    status = 'pass';
  }

  const summary = hasCritical
    ? 'Critical credential hygiene issues found'
    : hasHighOrMedium
      ? 'Credential hygiene could be improved'
      : 'Credential hygiene checks passed';

  return { name: 'Credentials', status, findings, summary };
}
