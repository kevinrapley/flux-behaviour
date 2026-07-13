import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('dashboard renders an accessible service-model and semantic coverage panel', () => {
  const template = readFileSync('demo/templates/pages/dashboard.njk', 'utf8');
  const dashboard = readFileSync('src/dashboard/live-dashboard.mjs', 'utf8');

  assert.match(template, /id="service-model-heading">Service model and data quality/);
  assert.match(template, /data-flux-service-model/);
  assert.match(dashboard, /serviceModel\.replaceChildren\(renderServiceModel\(analytics\.service_model\)\)/);
  assert.match(dashboard, /Semantic mapping coverage/);
  assert.match(dashboard, /Configured entities/);
  assert.match(dashboard, /Configured outcomes/);
  assert.match(dashboard, /key events/);
  assert.match(dashboard, /Transaction complexity/);
  assert.match(dashboard, /tableHead\(\['Transaction', 'Questions', 'Complexity'\]\)/);
  assert.match(dashboard, /Configured key events and outcomes/);
  assert.match(dashboard, /tableHead\(\['Key event', 'Outcome', 'Type', 'Events', 'Sessions'\]\)/);
  assert.match(dashboard, /flux-service-model__table-scroll/);
  assert.match(readFileSync('demo/styles/demo.scss', 'utf8'), /\.flux-service-model__table-scroll\s*\{[^}]*overflow-x:\s*auto/s);
});
