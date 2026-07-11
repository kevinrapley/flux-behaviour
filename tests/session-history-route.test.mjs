import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('dashboard exposes an authenticated complete history route for a single session', () => {
  const source = readFileSync('src/product/router.mjs', 'utf8');
  assert.match(source, /\/api\/dashboard\/researchops\/session\//);
  assert.match(source, /session_id = \? ORDER BY occurred_at_ms ASC/);
  assert.match(source, /scoreSessionDimensions\(events\.results\)/);
});

test('dashboard offers a complete-session-history control for bounded overview journeys', () => {
  const source = readFileSync('src/dashboard/live-dashboard.mjs', 'utf8');
  assert.match(source, /View journey/);
  assert.match(source, /encodeURIComponent\(session\.id\)/);
  assert.match(source, /Complete journey history is temporarily unavailable/);
});

test('dashboard API aggregates cumulative audience metrics for a selected period', () => {
  const source = readFileSync('src/product/router.mjs', 'utf8');
  assert.match(source, /dashboardRange\(new URL\(request\.url\)\.searchParams\.get\('range'\)\)/);
  assert.match(source, /COUNT\(DISTINCT visitor_id\) AS visitor_count/);
  assert.match(source, /returning_visitor_count/);
  assert.match(source, /GROUP BY day ORDER BY day ASC/);
  assert.match(source, /buildOverviewMetrics\(sessions, events\)/);
});
