import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('dashboard offers bounded standard and custom date controls', () => {
  const template = readFileSync('demo/templates/pages/dashboard.njk', 'utf8');
  const dashboard = readFileSync('src/dashboard/live-dashboard.mjs', 'utf8');
  const styles = readFileSync('demo/styles/demo.scss', 'utf8');

  assert.match(template, /data-flux-range="24h">24 hours/);
  assert.match(template, /data-flux-range="1y">1 year/);
  assert.match(template, /data-flux-range="custom">Custom/);
  assert.match(template, /data-flux-custom-range/);
  assert.match(template, /data-flux-custom-start/);
  assert.match(template, /data-flux-custom-end/);
  assert.match(template, /data-flux-custom-apply/);
  assert.match(template, /data-flux-compare/);
  assert.match(template, /id="comparison-report-heading">Journey comparison/);
  assert.match(template, /data-flux-comparison-report/);
  assert.match(template, /data-flux-export-report/);
  assert.match(template, /data-flux-export/);
  assert.match(template, /Never raw events/);
  assert.match(dashboard, /customRange\.hidden = currentRange !== 'custom'/);
  assert.match(dashboard, /params\.set\('start', customStart\.value\)/);
  assert.match(dashboard, /params\.set\('end', customEnd\.value\)/);
  assert.match(dashboard, /renderComparisonReport\(analytics\.comparison_report, analytics\.comparison_mode\)/);
  assert.match(dashboard, /compareSelect\?\.addEventListener\('change',[\s\S]*?updateExportLink\(\);[\s\S]*?loadDashboard\(\)/);
  assert.match(dashboard, /\['Group', 'Journeys', 'Interactions per journey', 'Completion', 'Friction'\]/);
  assert.match(dashboard, /exportLink\.href = `\/api\/dashboard\/researchops\/export\.csv\?\$\{params\.toString\(\)\}`/);
  assert.match(styles, /\.flux-dashboard__custom-range/);
});
