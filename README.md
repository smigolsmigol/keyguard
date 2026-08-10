# KeyGuard

KeyGuard is an experimental Node.js CLI for checking a repository's basic security hygiene. It reports findings across secret patterns, GitHub Actions configuration, credential-file exclusions, configuration integrity, and project-health files. It can also make a limited set of local fixes.

## Run from a checkout

Requires Node.js 18 or later.

```bash
npm ci --ignore-scripts
npm run build
node dist/index.js scan --no-color
```

The published package metadata names the package `kguard` and exposes the `kguard` command, but this repository does not provide a release receipt. Use the checkout commands above when evaluating this revision.

## Commands

```text
kguard init      Create .keyguard.yml when one does not exist
kguard scan      Report findings; exits nonzero when a pillar fails
kguard fix       Apply supported local fixes
kguard verify    Check the stored .keyguard.yml integrity hash
```

`init` creates a configuration based on detected project files. `scan` runs five implemented pillars:

- Secrets: predefined regular expressions in selected text-file extensions, banned-file names, and known MCP configuration files.
- Supply chain: GitHub Actions references in workflow jobs, top-level permissions, and write permissions outside the configuration allowlist.
- Credentials: `.gitignore`, `.cursorignore`, `.claudeignore`, and an optional vault-provider setting.
- Config integrity: consistency of the `.keyguard.yml` SHA-256 value.
- Health: presence of `SECURITY.md`, `CONTRIBUTING.md`, a README Security section, and recognized pre-commit configuration.

`fix` may edit workflow YAML and `.gitignore`, create `.cursorignore`, `.claudeignore`, or `SECURITY.md`, and update the configuration integrity hash. Review its diff before committing. Resolving an unpinned GitHub Action tag uses the GitHub API; unresolved references are reported for manual action.

## Configuration

`keyguard init` writes `.keyguard.yml`. The current implementation reads CI write allowlist and vault-provider values, and checks the integrity value. Keep the generated configuration under review alongside the repository policy.

```yaml
version: 1
secrets:
  patterns: []
ci:
  pin_actions: true
  require_permissions: true
  write_allowed: []
credentials:
  vault_provider: none
```

## Limits

KeyGuard is not a replacement for a secret manager, dependency vulnerability scanner, runtime security controls, GitHub branch protection, or incident monitoring. Its secret detection is pattern-based and can miss secrets or report false positives. Its integrity hash detects configuration changes that do not also update the hash; it is not protection against an attacker who can modify both the configuration and its hash.

The repository currently has one smoke-test file covering scan startup, version output, and help output. Treat a passing scan as evidence only for these implemented local checks.

## Security

Please follow [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Development

```bash
npm run build
npm test
```

License: MIT.
