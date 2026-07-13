import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { dashboardRealtime } from '../src/product/router.mjs';

test('realtime query returns privacy-safe 5 and 30 minute activity with ingestion freshness', async () => {
  const now = Date.UTC(2026, 6, 13, 12, 0, 30);
  const calls = [];
  const db = {
    prepare(sql) {
      const statement = {
        sql,
        values: [],
        bind(...values) { this.values = values; calls.push(this); return this; },
        async first() {
          if (sql.includes('FROM sessions')) return { active_sessions_5m: 3, active_sessions_30m: 7 };
          if (sql.startsWith('SELECT MAX(accepted_at_ms)')) return { latest_accepted_at_ms: now - (45 * 60000) };
          if (sql.includes('interactions_5m')) return { interactions_5m: 11, interactions_30m: 29 };
          throw new Error(`Unexpected realtime query: ${sql}`);
        },
        async all() {
          if (sql.includes('GROUP BY minute_start_ms')) return { results: [{ minute_start_ms: Math.floor(now / 60000) * 60000, interaction_count: 4 }] };
          throw new Error(`Unexpected realtime query: ${sql}`);
        }
      };
      return statement;
    }
  };

  const result = await dashboardRealtime({ FLUX_DB: db }, 'researchops', now);

  assert.equal(result.active_sessions_5m, 3);
  assert.equal(result.active_sessions_30m, 7);
  assert.equal(result.interactions_5m, 11);
  assert.equal(result.interactions_30m, 29);
  assert.equal(result.freshness_status, 'stale');
  assert.equal(result.latest_accepted_at_ms, now - (45 * 60000));
  assert.equal(result.interactions_per_minute.at(-1).interaction_count, 4);
  assert.ok(calls.every(({ values }) => values.includes('researchops')));
  assert.doesNotMatch(JSON.stringify(result), /visitor_id|session_id/);
});

test('authenticated dashboard response includes the realtime report', () => {
  const router = readFileSync('src/product/router.mjs', 'utf8');

  assert.match(router, /dashboardRealtime\(env, 'researchops'\)/);
  assert.match(router, /realtime/);
});
