import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('dashboard renders accessible transaction funnels and field coverage reports', () => {
  const template = readFileSync('demo/templates/pages/dashboard.njk', 'utf8');
  const dashboard = readFileSync('src/dashboard/live-dashboard.mjs', 'utf8');
  const styles = readFileSync('demo/styles/demo.scss', 'utf8');

  assert.match(template, /id="funnel-report-heading">Tasks and funnels/);
  assert.match(template, /data-flux-funnel-report/);
  assert.match(template, /id="field-report-heading">Fields/);
  assert.match(template, /data-flux-field-report/);
  assert.match(dashboard, /funnelReport\.replaceChildren\(renderFunnelReport\(analytics\.funnel_report\)\)/);
  assert.match(dashboard, /fieldReport\.replaceChildren\(renderFieldReport\(analytics\.field_report\)\)/);
  assert.match(dashboard, /\['Step', 'Reached journeys', 'Reach', 'Drop-off from previous'\]/);
  assert.match(dashboard, /Completion/);
  assert.match(dashboard, /Abandonment/);
  assert.match(dashboard, /Recovery/);
  assert.match(dashboard, /\['Field', 'Status', 'Exposed journeys', 'Interacted', 'Coverage', 'Edited', 'Validation', 'Outcome success', 'Corrections', 'Change'\]/);
  assert.match(dashboard, /Dwell before input distribution/);
  assert.match(dashboard, /Safe value-length distribution/);
  assert.match(styles, /\.flux-funnel__steps\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(styles, /\.flux-field-report__table\s*\{[^}]*overflow-x:\s*auto/s);
});
