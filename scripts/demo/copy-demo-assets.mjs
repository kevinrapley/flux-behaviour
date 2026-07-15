import { cp, mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
const outputRoot = resolve(root, process.argv[2] ?? 'public');

const directoryTargets = [
  ['node_modules/govuk-frontend/dist/govuk/assets', 'assets/govuk/assets'],
  ['src/sdk', 'assets/flux/sdk'],
  ['src/dashboard', 'assets/flux/dashboard'],
  ['src/admin', 'assets/flux/admin'],
  ['src/events', 'assets/flux/events'],
  ['demo/assets', 'assets/demo']
];

const fileTargets = [
  ['demo/static/_headers', '_headers'],
  ['node_modules/govuk-frontend/dist/govuk/govuk-frontend.min.js', 'assets/govuk/govuk-frontend.min.js'],
  ['node_modules/govuk-frontend/dist/govuk/govuk-frontend.min.js.map', 'assets/govuk/govuk-frontend.min.js.map'],
  ['node_modules/d3/dist/d3.min.js', 'assets/vendor/d3.min.js']
];

for (const [source, target] of directoryTargets) {
  await cp(resolve(root, source), resolve(outputRoot, target), { recursive: true, force: true });
}

for (const [source, target] of fileTargets) {
  const targetPath = resolve(outputRoot, target);
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(resolve(root, source), targetPath);
}

console.log(`Copied demo assets to ${outputRoot}/assets`);
