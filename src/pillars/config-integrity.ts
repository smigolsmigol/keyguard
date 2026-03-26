import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { computeConfigHash } from '../utils/hash.js';
import type { Finding, PillarResult, ScanContext } from '../types.js';

export async function scan(ctx: ScanContext): Promise<PillarResult> {
  const findings: Finding[] = [];
  const configPath = join(ctx.projectRoot, '.keyguard.yml');

  if (!existsSync(configPath)) {
    findings.push({
      rule: 'no-config',
      message: 'No .keyguard.yml found in project root',
      severity: 'medium',
      fix: 'Run `keyguard init` to create a configuration file',
    });

    return {
      name: 'Config Integrity',
      status: 'warn',
      findings,
      summary: 'No .keyguard.yml configuration file found',
    };
  }

  let content: string;
  try {
    content = readFileSync(configPath, 'utf-8');
  } catch {
    findings.push({
      rule: 'config-unreadable',
      message: '.keyguard.yml exists but could not be read',
      severity: 'high',
      file: '.keyguard.yml',
    });

    return {
      name: 'Config Integrity',
      status: 'fail',
      findings,
      summary: 'Configuration file exists but is unreadable',
    };
  }

  // verify integrity hash if present
  if (ctx.config.integrity) {
    const computed = computeConfigHash(content);
    if (computed !== ctx.config.integrity) {
      findings.push({
        rule: 'integrity-mismatch',
        message: `Config integrity hash mismatch (expected ${ctx.config.integrity.slice(0, 12)}..., got ${computed.slice(0, 12)}...)`,
        severity: 'critical',
        file: '.keyguard.yml',
        fix: 'Regenerate the integrity hash with `keyguard init --rehash` or verify the config has not been tampered with',
        autoFixable: true,
      });
    } else {
      findings.push({
        rule: 'integrity-verified',
        message: 'Config integrity hash verified',
        severity: 'info',
        file: '.keyguard.yml',
      });
    }
  } else {
    findings.push({
      rule: 'no-integrity-hash',
      message: 'No integrity hash in .keyguard.yml',
      severity: 'low',
      file: '.keyguard.yml',
      fix: 'Add an integrity hash with `keyguard init --rehash` to detect config tampering',
    });
  }

  // check .github directory existence
  const githubDir = join(ctx.projectRoot, '.github');
  if (!existsSync(githubDir)) {
    findings.push({
      rule: 'no-github-dir',
      message: 'No .github/ directory found',
      severity: 'info',
      fix: 'Create a .github/ directory for workflows, issue templates, and security policies',
    });
  }

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
    ? 'Config integrity check failed - hash mismatch'
    : 'Configuration verified';

  return { name: 'Config Integrity', status, findings, summary };
}
