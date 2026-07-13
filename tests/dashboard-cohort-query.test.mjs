import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dashboardCohorts } from '../src/product/router.mjs';

function d1() {
  const sessions = Array.from({ length: 6 }, (_, index) => ({
    id: `session-${index}`,
    started_at_ms: 1000 + index,
    last_seen_at_ms: index < 5 ? 2000 + index : 1000 + index,
    is_returning_visitor: 0,
    event_count: index < 5 ? 2 : 0,
    successful_outcome_count: index < 5 ? 1 : 0,
    friction_event_count: index < 5 ? 1 : 0
  }));
  const events = sessions.slice(0, 5).flatMap((session, index) => [
    { session_id: session.id, action: 'flow.submit', metadata_json: '{}', occurred_at_ms: 1500 + index },
    { session_id: session.id, action: 'field.revisit', metadata_json: '{"revisit_count":1}', occurred_at_ms: 1600 + index }
  ]);
  return {
    prepare(sql) {
      return {
        bind() {
          return this;
        },
        async all() {
          if (sql.includes("THEN 'first_time'")) return { results: [{ cohort_key: 'first_time', session_count: 6, completed_session_count: 5, friction_session_count: 5, returning_session_count: 0, average_session_duration_ms: 833.3 }] };
          if (sql.includes("THEN 'completed_smoothly'")) return { results: [{ cohort_key: 'completed_after_friction', session_count: 5, completed_session_count: 5, friction_session_count: 5, returning_session_count: 0, average_session_duration_ms: 1000 }, { cohort_key: 'in_progress', session_count: 1, completed_session_count: 0, friction_session_count: 0, returning_session_count: 0, average_session_duration_ms: 0 }] };
          if (sql.includes('AS event_count') && sql.includes('successful_outcome_count')) return { results: sessions };
          if (sql.includes('ORDER BY e.occurred_at_ms DESC LIMIT 10000')) return { results: events };
          throw new Error(`Unexpected cohort query: ${sql}`);
        }
      };
    }
  };
}

test('dashboard cohort query orchestration enforces aggregate suppression on the Node 20 baseline', async () => {
  const result = await dashboardCohorts({ FLUX_DB: d1() }, 0, 10000, 6);

  assert.deepEqual(result.visit_maturity.rows.map(({ key, session_count }) => ({ key, session_count })), [{ key: 'first_time', session_count: 6 }]);
  assert.deepEqual(result.outcome_paths.rows.map(({ key, session_count }) => ({ key, session_count })), [{ key: 'completed_after_friction', session_count: 5 }]);
  assert.equal(result.outcome_paths.suppressed_session_count, 1);
  assert.deepEqual(result.journey_patterns.rows.map(({ key, session_count }) => ({ key, session_count })), [{ key: 'careful_checker', session_count: 5 }]);
  assert.equal(result.journey_patterns.suppressed_session_count, 1);
  assert.doesNotMatch(JSON.stringify(result), /visitor_id|session_id|visitor-/);
  const router = readFileSync('src/product/router.mjs', 'utf8');
  assert.match(router, /LEFT JOIN events e ON e\.session_id = s\.id AND e\.tenant_id = s\.tenant_id/);
  assert.match(router, /esc\.outcome_type = 'success'/);
  assert.doesNotMatch(router, /MAX\(CASE WHEN e\.action = 'flow\.submit' THEN 1 ELSE 0 END\) AS completed/);
  assert.match(router, /ORDER BY e\.occurred_at_ms DESC LIMIT 10000\) ORDER BY occurred_at_ms ASC/);
});
