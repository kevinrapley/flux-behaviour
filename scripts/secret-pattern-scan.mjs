import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ignoredDirs = new Set(['.git','node_modules','dist','coverage']);
const ignoredFiles = new Set(['scripts/secret-pattern-scan.mjs','RECENT_LEARNINGS.md','docs/security/secret-handling.md','docs/migration/source-inventory.md','SECURITY.md']);
const secretAssignmentName = '(?:SECRET|TOKEN|API_KEY|PASSWORD|PRIVATE_KEY|CLIENT_SECRET|ACCESS_KEY|BEARER_TOKEN)';
const secretAssignmentValue = '(?:"[^"\\n]{16,}"|\'[^\'\\n]{16,}\'|[A-Za-z0-9_./+=:@%\\-]{16,})';
const patterns = [
  new RegExp(`(?:^|[\\s"'])${secretAssignmentName}\\s*[:=]\\s*${secretAssignmentValue}`, 'im'),
  /gh[pousr]_[A-Za-z0-9_]{36,}/,
  /sk-[A-Za-z0-9_-]{20,}/
];

function walk(dir) {
  let out = [];
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue;
    const file = join(dir, entry);
    const stat = statSync(file);
    if (stat.isDirectory()) out = out.concat(walk(file));
    else out.push(file.replace(/^\.\//, ''));
  }
  return out;
}

const findings = [];
for (const file of walk('.')) {
  if (ignoredFiles.has(file)) continue;
  const content = readFileSync(file, 'utf8');
  if (patterns.some((pattern) => pattern.test(content))) findings.push(file);
}

if (findings.length) {
  console.error(`Potential secret patterns found:\n${findings.join('\n')}`);
  process.exit(1);
}

console.log('Secret pattern sanity scan passed.');
