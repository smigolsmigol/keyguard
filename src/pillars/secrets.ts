import { readFileSync, existsSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
import { listFiles } from '../utils/git.js';
import { SECRET_PATTERNS, BANNED_FILES, MCP_CONFIG_FILES } from '../utils/patterns.js';
import type { Finding, PillarResult, ScanContext } from '../types.js';

const SCANNABLE_EXTENSIONS = new Set([
  '.ts', '.js', '.py', '.json', '.yml', '.yaml', '.toml',
  '.cfg', '.ini', '.md', '.env', '.sh', '.bash', '.zsh',
]);

function isScannableFile(filePath: string): boolean {
  if (filePath.includes('node_modules')) return false;
  const lower = filePath.toLowerCase();
  if (lower.includes('.env')) return true;
  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx === -1) return false;
  return SCANNABLE_EXTENSIONS.has(lower.slice(dotIdx));
}

function scanFileForSecrets(filePath: string, relPath: string): Finding[] {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const findings: Finding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const sp of SECRET_PATTERNS) {
      if (sp.pattern.test(line)) {
        findings.push({
          rule: 'secret-in-source',
          message: `${sp.name} detected`,
          severity: sp.severity,
          file: relPath,
          line: i + 1,
          fix: `Remove the secret from source and use environment variables or a vault`,
          autoFixable: false,
        });
      }
    }
  }

  return findings;
}

function checkBannedFiles(projectRoot: string): Finding[] {
  const findings: Finding[] = [];
  const allFiles = listFiles(projectRoot);

  // pre-compute: exact names and glob extensions from BANNED_FILES
  const exactNames = new Set<string>();
  const bannedExts: string[] = [];
  for (const banned of BANNED_FILES) {
    if (banned.startsWith('*.') && banned.includes('.')) {
      bannedExts.push(banned.slice(1));
    } else {
      exactNames.add(banned);
    }
  }

  for (const fullPath of allFiles) {
    const rel = relative(projectRoot, fullPath).replace(/\\/g, '/');
    const name = basename(fullPath);

    if (exactNames.has(name)) {
      findings.push({
        rule: 'banned-file',
        message: `Sensitive file "${rel}" matches banned name "${name}"`,
        severity: 'high',
        file: rel,
        fix: `Remove ${rel} from the repository and add ${name} to .gitignore`,
        autoFixable: false,
      });
      continue;
    }

    for (const ext of bannedExts) {
      if (name.endsWith(ext)) {
        findings.push({
          rule: 'banned-file',
          message: `Sensitive file "${rel}" matches banned pattern "*${ext}"`,
          severity: 'high',
          file: rel,
          fix: `Remove ${rel} from the repository and add *${ext} to .gitignore`,
          autoFixable: false,
        });
        break;
      }
    }
  }

  return findings;
}

function checkMcpConfigs(projectRoot: string): Finding[] {
  const findings: Finding[] = [];

  for (const mcpFile of MCP_CONFIG_FILES) {
    const fullPath = join(projectRoot, mcpFile);
    if (!existsSync(fullPath)) continue;

    let content: string;
    try {
      content = readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const sp of SECRET_PATTERNS) {
        if (sp.pattern.test(line)) {
          findings.push({
            rule: 'secret-in-mcp-config',
            message: `${sp.name} found in MCP config "${mcpFile}"`,
            severity: 'critical',
            file: mcpFile,
            line: i + 1,
            fix: `Move the secret to an environment variable and reference it in the MCP config`,
            autoFixable: false,
          });
        }
      }
    }
  }

  return findings;
}

function deriveStatus(findings: Finding[]): 'pass' | 'fail' | 'warn' {
  const hasCriticalOrHigh = findings.some(
    (f) => f.severity === 'critical' || f.severity === 'high',
  );
  if (hasCriticalOrHigh) return 'fail';
  if (findings.length > 0) return 'warn';
  return 'pass';
}

export async function scan(ctx: ScanContext): Promise<PillarResult> {
  const findings: Finding[] = [];

  const scannableFiles = ctx.files.filter(isScannableFile);
  for (const file of scannableFiles) {
    // ctx.files contains absolute paths from listFiles(), don't double-join
    const relPath = relative(ctx.projectRoot, file);
    const results = scanFileForSecrets(file, relPath);
    findings.push(...results);
  }

  findings.push(...checkBannedFiles(ctx.projectRoot));
  findings.push(...checkMcpConfigs(ctx.projectRoot));

  const status = deriveStatus(findings);
  const summary =
    findings.length === 0
      ? 'No secrets detected'
      : `Found ${findings.length} potential secret(s) across scanned files`;

  return { name: 'Secrets', status, findings, summary };
}
