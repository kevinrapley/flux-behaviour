import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dashboardCohorts } from '../src/product/router.mjs';

function d1(database) {
  return {
    prepare(sql) {
      let values = [];
      return {
        bind(...bindings) {
          values = bindings;
          return this;
        },
        async all() {
          return { results: database.prepare(sql).all(...values) };
        }
      };
    }
  };
}

test('dashboard cohort queries run against the production schema and enforce aggregate suppression', async () => {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync('migrations/0001_flux_behaviour.sql', 'utf8'));
  const visitor = database.prepare('INSERT INTO visitors (tenant_id, visitor_id, first_seen_at_ms, last_seen_at_ms, session_count) VALUES (?, ?, ?, ?, ?)');
  const session = database.prepare('INSERT INTO sessions (id, tenant_id, visitor_id, started_at_ms, last_seen_at_ms, is_returning_visitor) VALUES (?, ?, ?, ?, ?, ?)');
  const event = database.prepare('INSERT INTO events (id, tenant_id, visitor_id, session_id, event_class, action, role, element_key, metadata_json, narrative, occurred_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

  for (let index = 0; index < 5; index += 1) {
    const visitorId = `visitor-${index}`;
    const sessionId = `session-${index}`;
    visitor.run('researchops', visitorId, 1000, 2000, 1);
    session.run(sessionId, 'researchops', visitorId, 1000 + index, 2000 + index, 0);
    event.run(`event-${index}`, 'researchops', visitorId, sessionId, 'flow', 'flow.submit', 'form', 'researchops.form.1', '{}', 'Submit form.', 1500 + index);
  }
  visitor.run('researchops', 'visitor-small', 1000, 2000, 1);
  session.run('session-small', 'researchops', 'visitor-small', 1100, 1100, 0);

  const result = await dashboardCohorts({ FLUX_DB: d1(database) }, 0, 10000, 6);

  assert.deepEqual(result.visit_maturity.rows.map(({ key, session_count }) => ({ key, session_count })), [{ key: 'first_time', session_count: 6 }]);
  assert.deepEqual(result.outcome_paths.rows.map(({ key, session_count }) => ({ key, session_count })), [{ key: 'completed_smoothly', session_count: 5 }]);
  assert.equal(result.outcome_paths.suppressed_session_count, 1);
  assert.deepEqual(result.journey_patterns.rows.map(({ key, session_count }) => ({ key, session_count })), [{ key: 'careful_checker', session_count: 5 }]);
  assert.equal(result.journey_patterns.suppressed_session_count, 1);
  assert.doesNotMatch(JSON.stringify(result), /visitor_id|session_id|visitor-/);
  database.close();
});
