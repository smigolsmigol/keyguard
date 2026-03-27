# Security Policy

## Reporting a Vulnerability

Do not open a public issue. Email security@llmkit.dev or DM @smigolsmigol on X.

Include: what you found, steps to reproduce, and your assessment of impact.

We acknowledge within 48 hours and fix critical issues within 7 days.

## Security Practices

KeyGuard is a security tool - it should hold itself to the same standards it enforces on other projects.

**Supply chain**: All CI actions pinned to commit SHAs. npm packages published with Sigstore provenance attestation via GitHub Actions OIDC.

**Secret scanning**: gitleaks runs in CI on every push. Pre-commit hooks block credential files and secret patterns locally.

**Dogfooding**: KeyGuard scans its own repo in CI. If it fails its own checks, the build fails.

**Dependencies**: One runtime dependency (js-yaml). Minimal attack surface.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| latest  | Yes       |
