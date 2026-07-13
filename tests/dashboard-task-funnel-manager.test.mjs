import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('tasks report provides an accessible owner configuration surface', () => {
  const template = readFileSync('demo/templates/pages/dashboard.njk', 'utf8');

  assert.match(template, /data-flux-dashboard[^>]+data-flux-tenant="researchops"/);
  assert.match(template, /id="task-funnel-manager-heading">Configure tasks and funnels/);
  assert.match(template, /class="govuk-details flux-model-manager__disclosure"/);
  assert.match(template, /Manage published configuration/);
  assert.match(template, /data-flux-task-funnel-manager/);
  assert.match(template, /Each saved change publishes a new model version/);
});

test('dashboard loads and publishes tenant-owned task and funnel configuration', () => {
  const runtime = readFileSync('src/dashboard/live-dashboard.mjs', 'utf8');
  const manager = readFileSync('src/dashboard/task-funnel-manager.mjs', 'utf8');

  assert.match(runtime, /from '\.\/task-funnel-manager\.mjs'/);
  assert.match(manager, /from '\.\/task-funnel-configuration\.mjs'/);
  assert.match(manager, /fetch\(`\/api\/service-model\/\$\{encodeURIComponent\(tenantId\)\}`/);
  assert.match(manager, /configuration\.role !== 'owner'/);
  assert.match(manager, /method: 'PUT'/);
  assert.match(manager, /createFunnel/);
  assert.match(manager, /createTask/);
  assert.match(manager, /createStep/);
  assert.match(manager, /createSuccessEvent/);
  assert.match(manager, /deleteEntity/);
  assert.match(manager, /moveEntity/);
  assert.match(manager, /if \(!root \|\| !tenantId \|\| loading \|\| editor\) return/);
});

test('task and funnel configuration remains usable on narrow screens', () => {
  const styles = readFileSync('demo/styles/demo.scss', 'utf8');

  assert.match(styles, /\.flux-model-manager__actions\s*\{[^}]*display:\s*flex/s);
  assert.match(styles, /\.flux-model-manager__form\s*\{[^}]*border-left:/s);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.flux-model-manager__actions/);
});
