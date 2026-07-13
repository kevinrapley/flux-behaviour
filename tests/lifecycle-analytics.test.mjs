import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLifecycleReport, dashboardLifecycleAnalytics } from '../src/product/lifecycle-analytics.mjs';

const DAY = 86400000;
const period = { start_at_ms: 100 * DAY, end_at_ms: 130 * DAY, previous_start_at_ms: 70 * DAY, previous_end_at_ms: 100 * DAY };

test('builds suppressed recency, maturity movement and like-for-like celeration without returning identities', () => {
  const visits = [];
  for (let index = 0; index < 6; index += 1) {
    visits.push({ visitor_id: `private-${index}`, period_key: 'previous', started_at_ms: (80 + index) * DAY, previous_started_at_ms: index < 5 ? (70 + index) * DAY : null, visit_number: index < 5 ? 2 : 1 });
    visits.push({ visitor_id: `private-${index}`, period_key: 'current', started_at_ms: (110 + index) * DAY, previous_started_at_ms: (80 + index) * DAY, visit_number: index < 5 ? 3 : 2 });
  }
  const report = buildLifecycleReport(visits, [
    { period_key: 'current', action: 'error.invalid', affected_session_count: 2 },
    { period_key: 'previous', action: 'error.invalid', affected_session_count: 4 }
  ], period);

  assert.equal(report.recency.available, true);
  assert.equal(report.recency.median_interval_ms, 30 * DAY);
  assert.equal(report.recency.distribution.from_8_to_30_days, 6);
  assert.equal(report.recency.distribution.suppressed_interval_count, 0);
  assert.equal(report.frequency.average_journeys, 1);
  assert.equal(report.maturity_movement.rows[0].key, 'returning');
  assert.equal(report.celeration[0].rate, 33.3);
  assert.equal(report.celeration[0].previous_rate, 66.7);
  assert.equal(report.celeration[0].direction, 'decreased');
  assert.doesNotMatch(JSON.stringify(report), /private-/);
});

test('suppresses recency and rates below five journeys', () => {
  const visits = Array.from({ length: 4 }, (_, index) => ({ visitor_id: `v-${index}`, period_key: 'current', started_at_ms: (110 + index) * DAY, previous_started_at_ms: 90 * DAY, visit_number: 2 }));
  const report = buildLifecycleReport(visits, [], period);
  assert.equal(report.recency.available, false);
  assert.equal(report.recency.median_interval_ms, null);
  assert.equal(report.frequency.available, false);
  assert.equal(report.maturity_movement.rows.length, 0);
  assert.equal(report.celeration[0].rate, null);
});

test('queries full visit history for recency but returns only aggregate lifecycle evidence', async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) { calls.push({ sql, values }); return this; },
        async all() { return { results: [] }; }
      };
    }
  };
  const report = await dashboardLifecycleAnalytics(db, { tenantId: 'researchops', period });
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /LAG\(started_at_ms\).*PARTITION BY visitor_id/);
  assert.match(calls[0].sql, /ROW_NUMBER\(\).*PARTITION BY visitor_id/);
  assert.match(calls[1].sql, /COUNT\(DISTINCT ps\.id\)/);
  assert.equal(calls[0].values[0], 'researchops');
  assert.doesNotMatch(JSON.stringify(report), /visitor_id|session_id/);
});
