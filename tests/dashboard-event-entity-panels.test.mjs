import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('dashboard renders accessible event, key-event and semantic entity reports', () => {
  const template = readFileSync('demo/templates/pages/dashboard.njk', 'utf8');
  const dashboard = readFileSync('src/dashboard/live-dashboard.mjs', 'utf8');
  const styles = readFileSync('demo/styles/demo.scss', 'utf8');

  assert.match(template, /id="event-report-heading">Events and key events/);
  assert.match(template, /data-flux-event-report/);
  assert.match(template, /id="entity-report-heading">Service performance/);
  assert.match(template, /data-flux-entity-report/);
  assert.match(dashboard, /eventReport\.replaceChildren\(renderEventReport\(analytics\.event_report\)\)/);
  assert.match(dashboard, /entityReport\.replaceChildren\(renderEntityReport\(analytics\.entity_report\)\)/);
  assert.match(dashboard, /\['Event', 'Class', 'Interactions', 'Journeys', 'Journey rate', 'Change'\]/);
  assert.match(dashboard, /\['Key event', 'Outcome', 'Interactions', 'Journeys', 'Journey rate', 'Change'\]/);
  assert.match(dashboard, /\['Element', 'Type', 'Mapped purpose', 'Interactions', 'Journeys', 'Journey rate', 'Change'\]/);
  assert.match(dashboard, /\['Service entity', 'Journeys', 'Entry', 'Exit', 'Success', 'Friction', 'Average time', 'Change'\]/);
  assert.match(dashboard, /Transactions/);
  assert.match(dashboard, /Tasks/);
  assert.match(dashboard, /Steps/);
  assert.match(dashboard, /Questions/);
  assert.match(dashboard, /Fields/);
  assert.match(styles, /\.flux-report-table\s*\{[^}]*overflow-x:\s*auto/s);
});
