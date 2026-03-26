import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { KeyguardConfig } from './types.js';
import { computeConfigHash } from './utils/hash.js';
import { loadYaml, dumpYaml } from './utils/yaml.js';
import { fileExists } from './utils/git.js';

const CONFIG_FILE = '.keyguard.yml';

export function loadConfig(projectRoot: string): KeyguardConfig {
  const configPath = join(projectRoot, CONFIG_FILE);
  const config = loadYaml<KeyguardConfig>(configPath);
  if (!config) {
    return {
      version: 1,
      secrets: { patterns: [], scan: ['**/*'], banned_files: [] },
      ci: { pin_actions: true, require_permissions: true, write_allowed: [] },
      credentials: {},
    };
  }
  return config;
}

export function generateConfig(projectRoot: string): string {
  const stack = detectStack(projectRoot);

  const scanPaths = ['**/*'];
  const writeAllowed: string[] = [];

  if (stack.node) {
    scanPaths.push('!node_modules/**');
  }
  if (stack.python) {
    scanPaths.push('!venv/**', '!__pycache__/**', '!.venv/**');
  }
  if (stack.docker) {
    writeAllowed.push('packages: write');
  }
  if (stack.workflows) {
    writeAllowed.push('contents: read');
  }

  const config: KeyguardConfig = {
    version: 1,
    secrets: {
      patterns: [],
      scan: scanPaths,
      banned_files: ['.env', '.env.local', '.env.production', '*.pem', '*.key', '*.p12', '.npmrc', '.pypirc'],
    },
    ci: {
      pin_actions: true,
      require_permissions: true,
      write_allowed: writeAllowed,
    },
    credentials: {
      vault_provider: 'none',
      required_keys: [],
    },
  };

  let content = `# KeyGuard configuration\n# https://github.com/smigolsmigol/keyguard\n\n`;
  content += dumpYaml(config);
  content += `\nintegrity: PLACEHOLDER\n`;

  // compute hash on content as it will look after stripping the integrity line
  const hash = computeConfigHash(content);
  content = content.replace('integrity: PLACEHOLDER', `integrity: ${hash}`);

  return content;
}

export function updateIntegrity(projectRoot: string): void {
  const configPath = join(projectRoot, CONFIG_FILE);
  if (!existsSync(configPath)) return;

  let content = readFileSync(configPath, 'utf-8');

  const hash = computeConfigHash(content);

  // replace existing integrity line or append
  if (/^integrity:\s*.+$/m.test(content)) {
    content = content.replace(/^integrity:\s*.+$/m, `integrity: ${hash}`);
  } else {
    content = content.trimEnd() + `\nintegrity: ${hash}\n`;
  }

  writeFileSync(configPath, content, 'utf-8');
}

interface StackInfo {
  node: boolean;
  python: boolean;
  docker: boolean;
  workflows: boolean;
}

function detectStack(projectRoot: string): StackInfo {
  return {
    node: fileExists(join(projectRoot, 'package.json')),
    python: fileExists(join(projectRoot, 'pyproject.toml')) || fileExists(join(projectRoot, 'requirements.txt')),
    docker: fileExists(join(projectRoot, 'Dockerfile')) || fileExists(join(projectRoot, 'docker-compose.yml')),
    workflows: existsSync(join(projectRoot, '.github', 'workflows')),
  };
}
