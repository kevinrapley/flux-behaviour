import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('dashboard renders an accessible realtime activity and ingestion-health panel', () => {
  const template = readFileSync('demo/templates/pages/dashboard.njk', 'utf8');
  const dashboard = readFileSync('src/dashboard/live-dashboard.mjs', 'utf8');

  assert.match(template, /id="realtime-heading">Realtime activity/);
  assert.match(template, /data-flux-realtime/);
  assert.match(dashboard, /realtime\.replaceChildren\(renderRealtime\(analytics\.realtime\)\)/);
  assert.match(dashboard, /Active sessions · 5 minutes/);
  assert.match(dashboard, /Interactions · 30 minutes/);
  assert.match(dashboard, /Ingestion freshness/);
  assert.match(dashboard, /Interactions per minute/);
  assert.match(dashboard, /tableHead\(\['Minute', 'Interactions'\]\)/);
});
