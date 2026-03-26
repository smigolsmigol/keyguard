import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadYamlString } from '../utils/yaml.js';
import type { Finding, PillarResult, ScanContext } from '../types.js';

const SHA_PINNED = /^[a-f0-9]{40}$/;

interface WorkflowJob {
  permissions?: Record<string, string>;
  steps?: Array<{ uses?: string; name?: string }>;
}

interface Workflow {
  name?: string;
  permissions?: Record<string, string>;
  jobs?: Record<string, WorkflowJob>;
}

function parseActionRef(usesLine: string): { action: string; ref: string } | null {
  const trimmed = usesLine.trim();
  if (trimmed.startsWith('.')) return null; // local action
  if (trimmed.startsWith('docker://')) return null;
  const atIdx = trimmed.indexOf('@');
  if (atIdx === -1) return null;
  const ref = trimmed.slice(atIdx + 1).split(/\s/)[0];
  return { action: trimmed.slice(0, atIdx), ref };
}

function scanWorkflow(
  filePath: string,
  relPath: string,
  writeAllowed: string[],
): Finding[] {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const workflow = loadYamlString<Workflow>(content);
  if (!workflow) return [];

  const findings: Finding[] = [];
  const allowedSet = new Set(writeAllowed);

  // check top-level permissions block
  if (!workflow.permissions) {
    findings.push({
      rule: 'missing-permissions',
      message: `Workflow missing top-level permissions block`,
      severity: 'medium',
      file: relPath,
      fix: `Add a top-level "permissions: {}" block with least-privilege scoping`,
    });
  }

  if (!workflow.jobs) return findings;

  for (const [jobName, job] of Object.entries(workflow.jobs)) {
    // check for write permissions not in allow list
    const perms = job.permissions ?? workflow.permissions;
    if (perms) {
      for (const [scope, level] of Object.entries(perms)) {
        if (level === 'write' && !allowedSet.has(`${relPath}:${jobName}`)) {
          findings.push({
            rule: 'write-permission',
            message: `Job "${jobName}" has ${scope}: write`,
            severity: 'low',
            file: relPath,
            fix: `Verify this write permission is necessary or add to ci.write_allowed in .keyguard.yml`,
          });
        }
      }
    }

    if (!job.steps) continue;

    for (const step of job.steps) {
      if (!step.uses) continue;

      const parsed = parseActionRef(step.uses);
      if (!parsed) continue;

      if (!SHA_PINNED.test(parsed.ref)) {
        findings.push({
          rule: 'unpinned-action',
          message: `Action "${parsed.action}" uses mutable ref "${parsed.ref}" instead of SHA pin`,
          severity: 'high',
          file: relPath,
          line: findLineNumber(content, step.uses),
          fix: `Pin to a full SHA: ${parsed.action}@<commit-sha>`,
          autoFixable: false,
        });
      }
    }
  }

  return findings;
}

function findLineNumber(content: string, needle: string): number | undefined {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) return i + 1;
  }
  return undefined;
}

export async function scan(ctx: ScanContext): Promise<PillarResult> {
  const findings: Finding[] = [];
  const workflowDir = join(ctx.projectRoot, '.github', 'workflows');

  if (!existsSync(workflowDir)) {
    return {
      name: 'Supply Chain',
      status: 'skip',
      findings: [],
      summary: 'No .github/workflows directory found',
    };
  }

  let workflowFiles: string[];
  try {
    workflowFiles = readdirSync(workflowDir)
      .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  } catch {
    return {
      name: 'Supply Chain',
      status: 'skip',
      findings: [],
      summary: 'Could not read workflows directory',
    };
  }

  const writeAllowed = ctx.config.ci?.write_allowed ?? [];

  for (const file of workflowFiles) {
    const fullPath = join(workflowDir, file);
    const relPath = `.github/workflows/${file}`;
    findings.push(...scanWorkflow(fullPath, relPath, writeAllowed));
  }

  const unpinned = findings.filter((f) => f.rule === 'unpinned-action').length;
  const missingPerms = findings.filter((f) => f.rule === 'missing-permissions').length;

  let status: 'pass' | 'fail' | 'warn';
  if (unpinned > 0) {
    status = 'fail';
  } else if (missingPerms > 0) {
    status = 'warn';
  } else {
    status = 'pass';
  }

  const parts: string[] = [];
  if (unpinned > 0) parts.push(`${unpinned} unpinned action(s)`);
  if (missingPerms > 0) parts.push(`${missingPerms} workflow(s) missing permissions`);
  const summary = parts.length > 0
    ? `Scanned ${workflowFiles.length} workflow(s): ${parts.join(', ')}`
    : `All ${workflowFiles.length} workflow(s) pass supply chain checks`;

  return { name: 'Supply Chain', status, findings, summary };
}
