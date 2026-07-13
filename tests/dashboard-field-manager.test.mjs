import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('fields report provides a collapsed accessible owner configuration surface', () => {
  const template = readFileSync('demo/templates/pages/dashboard.njk', 'utf8');

  assert.match(template, /id="field-manager-heading">Configure fields and complexity/);
  assert.match(template, /Manage field configuration/);
  assert.match(template, /data-flux-field-manager/);
  assert.match(template, /Complexity is declared from 1 to 7/);
});

test('dashboard loads and publishes tenant-owned field configuration', () => {
  const runtime = readFileSync('src/dashboard/live-dashboard.mjs', 'utf8');
  assert.equal(existsSync('src/dashboard/field-manager.mjs'), true);
  const manager = readFileSync('src/dashboard/field-manager.mjs', 'utf8');

  assert.match(runtime, /from '\.\/field-manager\.mjs'/);
  assert.match(runtime, /data-flux-field-manager/);
  assert.match(manager, /from '\.\/field-configuration\.mjs'/);
  assert.match(manager, /configuration\.role === 'owner'/);
  assert.match(manager, /method: 'PUT'/);
  assert.match(manager, /createQuestionGroup/);
  assert.match(manager, /updateQuestionGroup/);
  assert.match(manager, /createField/);
  assert.match(manager, /updateField/);
  assert.match(manager, /deleteFieldEntity/);
  assert.match(manager, /if \(!root \|\| !tenantId \|\| loading \|\| editor\) return/);
  assert.match(manager, /configured success event/);
});

test('field configuration contains hierarchy and actions on narrow screens', () => {
  const styles = readFileSync('demo/styles/demo.scss', 'utf8');

  assert.match(styles, /\.flux-field-manager__question\s*\{[^}]*border-top:/s);
  assert.match(styles, /\.flux-field-manager__field\s*\{[^}]*display:\s*flex/s);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.flux-field-manager__field/);
});
