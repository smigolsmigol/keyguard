# Contributing to KeyGuard

## Quick setup

```bash
git clone https://github.com/smigolsmigol/keyguard.git
cd keyguard
npm install        # installs deps + activates pre-commit hooks
npm test           # run test suite
npm run build      # compile TypeScript
node dist/index.js scan   # dogfood: scan this repo
```

`npm install` runs the `prepare` script which sets `core.hooksPath` to `.github/hooks/`. The pre-commit hook scans staged files for secrets before every commit.

## Running locally

```bash
npm run dev        # watch mode (tsc --watch)
node dist/index.js scan --no-color   # test against any repo
```

## Pull requests

1. Run `npm test` and `npm run build` before pushing
2. One feature or fix per PR
3. Clear description: what changed, why, how to test

## Code style

- TypeScript strict
- Follow existing patterns
- Comments only where the logic isn't obvious
- One runtime dependency (js-yaml) - think twice before adding another

## Project structure

```
src/
  index.ts            CLI entry point
  scan.ts             core scanner orchestrator
  fix.ts              auto-fix logic
  config.ts           .keyguard.yml parsing + integrity
  types.ts            shared types
  pillars/            one file per security pillar
    secrets.ts        API key and credential detection
    supply-chain.ts   GitHub Actions pinning, permissions
    credentials.ts    .gitignore, AI tool exclusion files
    config-integrity.ts  self-hashing config verification
    health.ts         SECURITY.md, CONTRIBUTING.md, hooks
  utils/
    patterns.ts       secret detection patterns
    git.ts            git helpers
    github.ts         GitHub API helpers
    hash.ts           SHA-256 integrity
    yaml.ts           YAML parsing
test/
  *.test.mjs          test suite
```

## Need help?

Open an issue on GitHub.
