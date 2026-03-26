import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseActionRef, resolveActionSHA } from './utils/github.js';
import { readFile, fileExists } from './utils/git.js';
import { updateIntegrity } from './config.js';

export interface FixResult {
  fixed: string[];
  manual: string[];
}

export async function runFix(projectRoot: string): Promise<FixResult> {
  const fixed: string[] = [];
  const manual: string[] = [];

  await pinCIActions(projectRoot, fixed, manual);
  addCIPermissions(projectRoot, fixed);
  patchGitignore(projectRoot, fixed);
  createIgnoreFile(projectRoot, '.cursorignore', fixed);
  createIgnoreFile(projectRoot, '.claudeignore', fixed);
  createSecurityMd(projectRoot, fixed);

  // manual items that can't be auto-fixed
  manual.push('Enable 2FA on your GitHub account (Settings -> Password and authentication)');
  manual.push('Set up a secrets vault (e.g. 1Password, Doppler, Infisical) and update .keyguard.yml');
  manual.push('Review GitHub branch protection rules for main branch');

  if (fixed.length > 0) {
    updateIntegrity(projectRoot);
    fixed.push('Updated .keyguard.yml integrity hash');
  }

  return { fixed, manual };
}

async function pinCIActions(projectRoot: string, fixed: string[], manual: string[]): Promise<void> {
  const workflowDir = join(projectRoot, '.github', 'workflows');
  if (!existsSync(workflowDir)) return;

  let files: string[];
  try {
    files = readdirSync(workflowDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  } catch {
    return;
  }

  for (const file of files) {
    const filePath = join(workflowDir, file);
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;

    const lines = content.split('\n');
    const updatedLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('uses:')) {
        updatedLines.push(line);
        continue;
      }

      const ref = parseActionRef(trimmed);
      if (!ref) {
        updatedLines.push(line);
        continue;
      }

      // already pinned to a SHA
      if (/^[a-f0-9]{40}$/.test(ref.ref)) {
        updatedLines.push(line);
        continue;
      }

      const sha = await resolveActionSHA(ref.owner, ref.repo, ref.ref);
      if (!sha) {
        manual.push(`Could not resolve SHA for ${ref.owner}/${ref.repo}@${ref.ref} in ${file}`);
        updatedLines.push(line);
        continue;
      }

      const pinnedUses = `${ref.owner}/${ref.repo}@${sha}`;
      const comment = `# ${ref.ref}`;
      const indent = line.match(/^(\s*)/)?.[1] ?? '';
      updatedLines.push(`${indent}uses: ${pinnedUses} ${comment}`);
      modified = true;
      fixed.push(`Pinned ${ref.owner}/${ref.repo}@${ref.ref} -> ${sha.slice(0, 7)} in ${file}`);
    }

    if (modified) {
      writeFileSync(filePath, updatedLines.join('\n'), 'utf-8');
    }
  }
}

function addCIPermissions(projectRoot: string, fixed: string[]): void {
  const workflowDir = join(projectRoot, '.github', 'workflows');
  if (!existsSync(workflowDir)) return;

  let files: string[];
  try {
    files = readdirSync(workflowDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  } catch {
    return;
  }

  for (const file of files) {
    const filePath = join(workflowDir, file);
    let content = readFileSync(filePath, 'utf-8');

    // skip if already has top-level permissions
    if (/^permissions:/m.test(content)) continue;

    // insert after the `on:` block. find the `on:` line, then find the next
    // top-level key (a line starting with a non-space, non-comment char that
    // isn't inside the on block)
    const lines = content.split('\n');
    let insertIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (/^on\s*:/.test(lines[i])) {
        // find end of on block: next line at indent 0 that's a yaml key
        for (let j = i + 1; j < lines.length; j++) {
          if (/^[a-zA-Z]/.test(lines[j]) && !lines[j].startsWith('#')) {
            insertIdx = j;
            break;
          }
        }
        if (insertIdx === -1) insertIdx = lines.length;
        break;
      }
    }

    if (insertIdx === -1) continue;

    lines.splice(insertIdx, 0, '', 'permissions:', '  contents: read', '');
    writeFileSync(filePath, lines.join('\n'), 'utf-8');
    fixed.push(`Added permissions block to ${file}`);
  }
}

const ENV_PATTERNS = [
  '.env',
  '.env.*',
  '.env.local',
  '.env.production',
  '.env.staging',
  '.env.development',
  '*.pem',
  '*.key',
  '*.p12',
  '.npmrc',
  '.pypirc',
  '.dev.vars',
];

function patchGitignore(projectRoot: string, fixed: string[]): void {
  const gitignorePath = join(projectRoot, '.gitignore');
  let content = readFile(gitignorePath) ?? '';

  const existing = new Set(
    content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  );

  const toAdd = ENV_PATTERNS.filter((p) => !existing.has(p));
  if (toAdd.length === 0) return;

  const section = '\n# secrets and credentials (added by keyguard)\n' + toAdd.join('\n') + '\n';
  content = content.trimEnd() + '\n' + section;
  writeFileSync(gitignorePath, content, 'utf-8');
  fixed.push(`Added ${toAdd.length} pattern${toAdd.length === 1 ? '' : 's'} to .gitignore`);
}

function createIgnoreFile(projectRoot: string, filename: string, fixed: string[]): void {
  const filePath = join(projectRoot, filename);
  if (fileExists(filePath)) return;

  const content = [
    `# ${filename} - generated by keyguard`,
    '# Prevent AI tools from reading sensitive files',
    '',
    '.env',
    '.env.*',
    '*.pem',
    '*.key',
    '*.p12',
    '.npmrc',
    '.pypirc',
    '.dev.vars',
    'credentials.json',
    'service-account.json',
    '',
  ].join('\n');

  writeFileSync(filePath, content, 'utf-8');
  fixed.push(`Created ${filename}`);
}

function createSecurityMd(projectRoot: string, fixed: string[]): void {
  const securityPath = join(projectRoot, 'SECURITY.md');
  if (fileExists(securityPath)) return;

  // try to read project name from package.json
  let projectName = 'this project';
  const pkgPath = join(projectRoot, 'package.json');
  if (fileExists(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) projectName = pkg.name;
    } catch {
      // ignore
    }
  }

  const content = `# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in ${projectName}, please report it responsibly.

**Do not open a public issue.**

Email: [your-email@example.com]

Include:
- Description of the vulnerability
- Steps to reproduce
- Impact assessment

We will acknowledge receipt within 48 hours and aim to release a fix within 7 days for critical issues.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| latest  | Yes       |

## Security Practices

This project uses [KeyGuard](https://github.com/smigolsmigol/keyguard) to enforce:
- Secret detection in source code
- CI/CD supply chain integrity (pinned actions, least-privilege permissions)
- Credential hygiene (.gitignore, AI tool exclusions)
`;

  writeFileSync(securityPath, content, 'utf-8');
  fixed.push('Created SECURITY.md template');
}

// ansi helpers
const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

export function formatFix(result: FixResult): string {
  const lines: string[] = [];

  if (result.fixed.length > 0) {
    lines.push(`  ${c.green('\u2713')} ${c.bold('Auto-fixed:')}`);
    for (const item of result.fixed) {
      lines.push(`    ${c.green('\u2713')} ${item}`);
    }
  } else {
    lines.push(`  ${c.dim('Nothing to auto-fix.')}`);
  }

  if (result.manual.length > 0) {
    lines.push('');
    lines.push(`  ${c.yellow('\u26A0')} ${c.bold('Manual action required:')}`);
    for (const item of result.manual) {
      lines.push(`    ${c.yellow('\u2022')} ${item}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
