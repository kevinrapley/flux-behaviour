import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRealtimeSnapshot } from '../src/product/realtime-analytics.mjs';

test('builds a complete 30-minute activity series and ingestion freshness status', () => {
  const now = Date.UTC(2026, 6, 13, 10, 30, 45);
  const currentMinute = Date.UTC(2026, 6, 13, 10, 30);
  const result = buildRealtimeSnapshot({
    sessions: { active_sessions_5m: 2, active_sessions_30m: 5 },
    events: { interactions_5m: 8, interactions_30m: 21, latest_accepted_at_ms: now - 45000 },
    minutes: [
      { minute_start_ms: currentMinute - 120000, interaction_count: 4 },
      { minute_start_ms: currentMinute, interaction_count: 2 }
    ]
  }, now);

  assert.equal(result.active_sessions_5m, 2);
  assert.equal(result.active_sessions_30m, 5);
  assert.equal(result.interactions_5m, 8);
  assert.equal(result.interactions_30m, 21);
  assert.equal(result.latest_accepted_at_ms, now - 45000);
  assert.equal(result.freshness_ms, 45000);
  assert.equal(result.freshness_status, 'live');
  assert.equal(result.interactions_per_minute.length, 30);
  assert.deepEqual(result.interactions_per_minute.slice(-3), [
    { minute_start_ms: currentMinute - 120000, interaction_count: 4 },
    { minute_start_ms: currentMinute - 60000, interaction_count: 0 },
    { minute_start_ms: currentMinute, interaction_count: 2 }
  ]);
});

test('reports delayed, stale and no-data ingestion states without exposing identities', () => {
  const now = 1800000;

  assert.equal(buildRealtimeSnapshot({ events: { latest_accepted_at_ms: now - 300000 } }, now).freshness_status, 'delayed');
  assert.equal(buildRealtimeSnapshot({ events: { latest_accepted_at_ms: now - 900000 } }, now).freshness_status, 'stale');
  const empty = buildRealtimeSnapshot({}, now);
  assert.equal(empty.freshness_status, 'no_data');
  assert.equal(empty.latest_accepted_at_ms, null);
  assert.doesNotMatch(JSON.stringify(empty), /visitor_id|session_id/);
});
