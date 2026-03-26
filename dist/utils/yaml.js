import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
export function loadYaml(filePath) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        return yaml.load(content);
    }
    catch {
        return null;
    }
}
export function loadYamlString(content) {
    return yaml.load(content);
}
export function dumpYaml(data) {
    return yaml.dump(data, { lineWidth: 120, noRefs: true });
}
//# sourceMappingURL=yaml.js.map