#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot } from './utils/git.js';
import { computeConfigHash } from './utils/hash.js';

const VERSION = '0.1.0';
const CONFIG_FILE = '.keyguard.yml';

const NO_COLOR = !!process.env.NO_COLOR || process.argv.includes('--no-color');
const ansi = (code: string) => NO_COLOR ? (s: string) => s : (s: string) => `\x1b[${code}m${s}\x1b[0m`;
const bold = ansi('1');
const green = ansi('32');
const red = ansi('31');
const dim = ansi('2');

function banner(): void {
  console.log(`\n${bold('KeyGuard')} ${dim(`v${VERSION}`)}\n`);
}

function usage(): void {
  banner();
  console.log(`The missing security layer for open source\n`);
  console.log(`Usage:`);
  console.log(`  keyguard init      Generate .keyguard.yml with smart defaults`);
  console.log(`  keyguard scan      Scan project for security issues`);
  console.log(`  keyguard fix       Auto-fix security issues`);
  console.log(`  keyguard verify    Verify config integrity\n`);
  console.log(dim(`https://github.com/smigolsmigol/keyguard\n`));
}

async function cmdInit(): Promise<void> {
  banner();
  const root = findProjectRoot();
  const configPath = join(root, CONFIG_FILE);

  if (existsSync(configPath)) {
    console.log(`  ${CONFIG_FILE} already exists. Delete it first to regenerate.\n`);
    process.exit(1);
  }

  const { generateConfig } = await import('./config.js');
  const content = generateConfig(root);
  writeFileSync(configPath, content, 'utf-8');

  console.log(`  ${green('\u2713')} Created ${CONFIG_FILE}\n`);
  console.log(`  Next steps:`);
  console.log(`    1. Review ${CONFIG_FILE} and adjust for your project`);
  console.log(`    2. Run ${bold('keyguard scan')} to check current state`);
  console.log(`    3. Run ${bold('keyguard fix')} to auto-fix issues`);
  console.log(`    4. Add ${bold('keyguard scan')} to your CI pipeline\n`);
}

async function cmdScan(): Promise<void> {
  banner();
  const root = findProjectRoot();

  const { runScan, formatReport } = await import('./scan.js');
  const report = await runScan(root);
  console.log(formatReport(report));

  if (!report.passed) {
    process.exit(1);
  }
}

async function cmdFix(): Promise<void> {
  banner();
  const root = findProjectRoot();

  const { runFix, formatFix } = await import('./fix.js');
  const result = await runFix(root);
  console.log(formatFix(result));
}

function cmdVerify(): void {
  banner();
  const root = findProjectRoot();
  const configPath = join(root, CONFIG_FILE);

  if (!existsSync(configPath)) {
    console.log(`  ${red('\u2717')} No ${CONFIG_FILE} found. Run ${bold('keyguard init')} first.\n`);
    process.exit(1);
  }

  const content = readFileSync(configPath, 'utf-8');
  const match = content.match(/^integrity:\s*(.+)$/m);

  if (!match) {
    console.log(`  ${red('\u2717')} No integrity hash in ${CONFIG_FILE}. Run ${bold('keyguard fix')} to add one.\n`);
    process.exit(1);
  }

  const stored = match[1].trim();
  const computed = computeConfigHash(content);

  if (stored === computed) {
    console.log(`  ${green('\u2713')} Config integrity verified.\n`);
  } else {
    console.log(`  ${red('\u2717')} Integrity mismatch.`);
    console.log(`    Stored:   ${dim(stored)}`);
    console.log(`    Computed: ${dim(computed)}`);
    console.log(`\n  The config was modified outside of KeyGuard. Run ${bold('keyguard fix')} to update.\n`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const cmd = process.argv[2];

  switch (cmd) {
    case 'init':
      await cmdInit();
      break;
    case 'scan':
      await cmdScan();
      break;
    case 'fix':
      await cmdFix();
      break;
    case 'verify':
      cmdVerify();
      break;
    case 'version':
    case '--version':
    case '-v':
      console.log(VERSION);
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      usage();
      break;
    default:
      console.log(`\n  Unknown command: ${cmd}\n`);
      usage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n  ${red('Error:')} ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
