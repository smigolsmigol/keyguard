# KeyGuard

Security linter for open source projects. Finds and fixes what others only report.

```bash
npx keyguard scan
```

```
KeyGuard v0.1.0

  ✓ Secrets          PASS   No secrets detected
  ✓ Supply Chain      PASS   All 7 workflow(s) pass supply chain checks
  ✓ Credentials       PASS   Credential hygiene checks passed
  ✓ Config Integrity  PASS   Configuration verified
  ⚠ Health            WARN   2 health recommendation(s)

  Score: 4.5/5
```

## Why

Open source projects have standards for code quality (ESLint), dependency updates (Dependabot), and licensing. There's no equivalent for security posture: are CI actions pinned? Are secrets out of the codebase? Are AI coding tools blocked from reading `.env`?

Existing tools scan and report. They generate alerts you'll ignore (35% of Dependabot PRs are closed without merging). KeyGuard scans and *fixes*.

## What it checks

**5 pillars, one command.**

**Secrets** - scans source files for API keys (OpenAI, Anthropic, Google, AWS, Stripe, GitHub, HuggingFace, and more). Checks for banned files (`.env`, `.npmrc`, `.pypirc`, `*.pem`). Scans MCP configs for exposed credentials.

**Supply Chain** - verifies GitHub Actions are pinned to commit SHAs, not mutable tags. Checks for explicit permissions blocks and flags unnecessary write access. This is the exact vector that [compromised LiteLLM](https://docs.litellm.ai/blog/security-update-march-2026) on March 24, 2026.

**Credentials** - checks `.gitignore` covers secret files, verifies `.cursorignore` and `.claudeignore` exist (prevents AI coding tools from reading your secrets), checks vault configuration.

**Config Integrity** - the `.keyguard.yml` config includes its own SHA-256 hash. If someone tampers with your security policy, the hash check fails. Self-protecting configuration.

**Health** - checks for `SECURITY.md`, `CONTRIBUTING.md`, security section in README, pre-commit hooks.

## Quick start

```bash
# scan your project
npx keyguard scan

# generate config with smart defaults
npx keyguard init

# auto-fix what it finds
npx keyguard fix

# verify config hasn't been tampered with
npx keyguard verify
```

## The fix command

This is the part that matters. Other tools tell you about 47 problems. KeyGuard fixes them.

```bash
npx keyguard fix
```

```
  ✓ Auto-fixed:
    ✓ Pinned actions/checkout@v4 -> 34e1148 in ci.yml
    ✓ Pinned actions/setup-node@v4 -> 4993ea5 in ci.yml
    ✓ Added permissions block to deploy.yml
    ✓ Added 5 patterns to .gitignore
    ✓ Created .cursorignore
    ✓ Created .claudeignore
    ✓ Created SECURITY.md template
    ✓ Updated .keyguard.yml integrity hash

  ⚠ Manual action required:
    • Enable 2FA on your GitHub account
    • Set up a secrets vault and update .keyguard.yml
    • Review branch protection rules
```

What `fix` does automatically:
- Pins every GitHub Action to its commit SHA (resolves via GitHub API)
- Adds `permissions: contents: read` to workflows missing it
- Adds `.env`, `*.pem`, `*.key`, `.npmrc`, `.pypirc` to `.gitignore`
- Creates `.cursorignore` and `.claudeignore` to block AI tools from reading secrets
- Creates `SECURITY.md` with vulnerability reporting template
- Recomputes the `.keyguard.yml` integrity hash

## The config file

```yaml
version: 1
integrity: "sha256:a1b2c3..."

secrets:
  scan:
    - "**/*.ts"
    - "**/*.py"
    - "**/*.json"

ci:
  pin_actions: true
  require_permissions: true
  write_allowed:
    - "release.yml:publish"

credentials:
  vault_provider: none
```

The `integrity` field is a SHA-256 hash of the file's own content (excluding that line). An attacker who gains repo access can't silently weaken your security policy without the hash check failing. Run `keyguard verify` to check it.

## CI integration

```yaml
- name: security check
  run: npx keyguard scan
```

KeyGuard exits with code 1 on any failure. Drop it in your CI pipeline and it blocks PRs that introduce security issues.

## What this doesn't do

KeyGuard is a project-level security linter. It doesn't:
- Replace runtime security tools (WAFs, rate limiters, auth systems)
- Scan dependencies for CVEs (use `npm audit`, Socket, Snyk for that)
- Monitor for breaches after they happen (use GitGuardian, TruffleHog for that)
- Manage secrets at runtime (use Infisical, Doppler, HashiCorp Vault for that)

It works alongside all of these. KeyGuard checks that your project is set up to use them correctly.

## Flags

```
--no-color    Disable colored output
--version     Print version
--help        Show usage
```

Respects the `NO_COLOR` environment variable.

## Requirements

Node.js 18 or later. Single dependency: `js-yaml`.

## Context

On March 24, 2026, [LiteLLM was supply-chain attacked](https://thehackernews.com/2026/03/teampcp-backdoors-litellm-versions.html) through compromised GitHub Action tags. Malicious packages hit 95 million daily PyPI downloads. The same week, hundreds of GitHub accounts were [compromised via force-push attacks](https://www.stepsecurity.io/blog/forcememo-hundreds-of-github-python-repos-compromised-via-account-takeover-and-force-push). Open source security tooling detected these attacks, but nothing prevented them.

KeyGuard exists because reporting isn't enough. Projects need enforceable security baselines with auto-remediation.

## License

MIT

---

Built by the team behind [LLMKit](https://github.com/smigolsmigol/llmkit).
