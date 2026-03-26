import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
function checkSecurityMd(projectRoot) {
    const securityPath = join(projectRoot, 'SECURITY.md');
    if (!existsSync(securityPath)) {
        return {
            rule: 'no-security-md',
            message: 'No SECURITY.md found',
            severity: 'medium',
            fix: 'Create SECURITY.md with vulnerability reporting instructions',
            autoFixable: true,
        };
    }
    return null;
}
function checkContributingMd(projectRoot) {
    const contributingPath = join(projectRoot, 'CONTRIBUTING.md');
    if (!existsSync(contributingPath)) {
        return {
            rule: 'no-contributing-md',
            message: 'No CONTRIBUTING.md found',
            severity: 'low',
            fix: 'Create CONTRIBUTING.md with contribution guidelines',
        };
    }
    return null;
}
function checkReadmeSecuritySection(projectRoot) {
    const readmePath = join(projectRoot, 'README.md');
    if (!existsSync(readmePath)) {
        return {
            rule: 'no-readme',
            message: 'No README.md found',
            severity: 'low',
            fix: 'Create a README.md for the project',
        };
    }
    let content;
    try {
        content = readFileSync(readmePath, 'utf-8');
    }
    catch {
        return null;
    }
    const hasSecurityHeading = /^#{1,3}\s+security/im.test(content);
    if (!hasSecurityHeading) {
        return {
            rule: 'readme-no-security-section',
            message: 'README.md has no security section',
            severity: 'info',
            file: 'README.md',
            fix: 'Add a "## Security" section to README.md or reference SECURITY.md',
        };
    }
    return null;
}
function checkPreCommitHooks(projectRoot) {
    const preCommitYaml = join(projectRoot, '.pre-commit-config.yaml');
    const huskyDir = join(projectRoot, '.husky');
    const huskyRc = join(projectRoot, '.huskyrc');
    const huskyRcJs = join(projectRoot, '.huskyrc.js');
    // also check package.json for husky config
    let pkgHasHusky = false;
    try {
        const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));
        pkgHasHusky = !!pkg.husky;
    }
    catch {
        // no package.json or parse error, that's fine
    }
    const hasHooks = existsSync(preCommitYaml) ||
        existsSync(huskyDir) ||
        existsSync(huskyRc) ||
        existsSync(huskyRcJs) ||
        pkgHasHusky;
    if (!hasHooks) {
        return {
            rule: 'no-pre-commit-hooks',
            message: 'No pre-commit hook configuration found (husky, pre-commit, or similar)',
            severity: 'medium',
            fix: 'Set up pre-commit hooks to catch secrets before they reach git history',
        };
    }
    return null;
}
export async function scan(ctx) {
    const findings = [];
    const checks = [
        checkSecurityMd(ctx.projectRoot),
        checkContributingMd(ctx.projectRoot),
        checkReadmeSecuritySection(ctx.projectRoot),
        checkPreCommitHooks(ctx.projectRoot),
    ];
    for (const finding of checks) {
        if (finding)
            findings.push(finding);
    }
    // health pillar is advisory-only, never fails
    const hasMedium = findings.some((f) => f.severity === 'medium');
    const status = hasMedium ? 'warn' : 'pass';
    const summary = findings.length === 0
        ? 'All project health checks passed'
        : `${findings.length} health recommendation(s)`;
    return { name: 'Health', status, findings, summary };
}
//# sourceMappingURL=health.js.map