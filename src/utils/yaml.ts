import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

export function loadYaml<T>(filePath: string): T | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return yaml.load(content) as T;
  } catch {
    return null;
  }
}

export function loadYamlString<T>(content: string): T {
  return yaml.load(content) as T;
}

export function dumpYaml(data: unknown): string {
  return yaml.dump(data, { lineWidth: 120, noRefs: true });
}
