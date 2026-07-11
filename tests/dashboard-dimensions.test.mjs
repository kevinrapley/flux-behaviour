import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('live dashboard renders cumulative analytics and session indicators with interpretation safeguards', () => {
  const source = readFileSync('src/dashboard/live-dashboard.mjs', 'utf8');
  assert.match(source, /returning_visitor_rate/);
  assert.match(source, /View all 20 behavioural indicators/);
  assert.match(source, /not classifications or judgements of a person/);
  assert.match(source, /Session indicators describe interaction patterns/);
  assert.doesNotMatch(source, /session\.visitor_id/);
  const router = readFileSync('src/product/router.mjs', 'utf8');
  assert.doesNotMatch(router, /SELECT s\.id, s\.visitor_id/);
  assert.doesNotMatch(router, /SELECT id, visitor_id, started_at_ms/);
});
