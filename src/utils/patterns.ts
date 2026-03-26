import type { Severity } from '../types.js';

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: Severity;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: 'OpenAI API Key',
    pattern: /sk-(?!ant)[a-zA-Z0-9][a-zA-Z0-9_-]{19,}/,
    severity: 'critical',
  },
  {
    name: 'Anthropic API Key',
    pattern: /sk-ant-[a-zA-Z0-9]{20,}/,
    severity: 'critical',
  },
  {
    name: 'Google AI/Maps Key',
    pattern: /AIza[a-zA-Z0-9_-]{35}/,
    severity: 'critical',
  },
  {
    name: 'xAI API Key',
    pattern: /xai-[a-zA-Z0-9]{20,}/,
    severity: 'critical',
  },
  {
    name: 'AWS Access Key',
    pattern: /AKIA[A-Z0-9]{16}/,
    severity: 'critical',
  },
  {
    name: 'AWS Secret Key',
    pattern: /(?:aws_secret|AWS_SECRET)[_A-Z]*\s*[=:]\s*[a-zA-Z0-9/+=]{40}/,
    severity: 'critical',
  },
  {
    name: 'GitHub Token',
    pattern: /gh[ps]_[a-zA-Z0-9]{36,}/,
    severity: 'critical',
  },
  {
    name: 'GitHub Fine-Grained Token',
    pattern: /github_pat_[a-zA-Z0-9_]{82,}/,
    severity: 'critical',
  },
  {
    name: 'Slack Token',
    pattern: /xox[bpas]-[a-zA-Z0-9-]+/,
    severity: 'high',
  },
  {
    name: 'Stripe Secret Key',
    pattern: /sk_live_[a-zA-Z0-9]{24,}/,
    severity: 'critical',
  },
  {
    name: 'HuggingFace Token',
    pattern: /hf_[a-zA-Z0-9]{34,}/,
    severity: 'high',
  },
  {
    name: 'Supabase/JWT Key',
    pattern: /(?:SUPABASE|supabase|JWT|jwt|SECRET|secret|KEY|key)\s*[=:]\s*eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+/,
    severity: 'high',
  },
  {
    name: 'Private Key Block',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
    severity: 'critical',
  },
  {
    name: 'Hardcoded Password',
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*["'][^"']{8,}["']/i,
    severity: 'medium',
  },
];

export const BANNED_FILES: string[] = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.staging',
  '.env.development',
  '.npmrc',
  '.pypirc',
  '*.pem',
  '*.key',
  '*.p12',
  'credentials.json',
  'service-account.json',
];

export const MCP_CONFIG_FILES: string[] = [
  'mcp.json',
  '.mcp.json',
  'claude_desktop_config.json',
  'cline_mcp_settings.json',
];
