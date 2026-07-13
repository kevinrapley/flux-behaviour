import test from 'node:test';
import assert from 'node:assert/strict';
import { buildComparisonReport, dashboardComparisonReport } from '../src/product/comparison-reports.mjs';

test('builds safe comparison groups with completion, friction and minimum-size suppression', () => {
  const report = buildComparisonReport({
    mode: 'visit_maturity',
    minimumGroupSize: 5,
    rows: [
      { group_key: 'first_time', label: 'First-time journeys', session_count: 8, interaction_count: 42, completed_session_count: 5, friction_session_count: 2 },
      { group_key: 'returning', label: 'Returning journeys', session_count: 3, interaction_count: 20, completed_session_count: 3, friction_session_count: 1 }
    ]
  });

  assert.deepEqual(report, {
    mode: 'visit_maturity',
    label: 'Visit maturity',
    minimum_group_size: 5,
    caveat: 'Groups smaller than 5 journeys are suppressed. Differences are descriptive service evidence and do not establish cause.',
    rows: [
      { group_key: 'first_time', label: 'First-time journeys', suppressed: false, session_count: 8, interaction_count: 42, interactions_per_session: 5.3, completed_session_count: 5, completion_rate: 62.5, friction_session_count: 2, friction_rate: 25 },
      { group_key: 'returning', label: 'Returning journeys', suppressed: true, session_count: null, interaction_count: null, interactions_per_session: null, completed_session_count: null, completion_rate: null, friction_session_count: null, friction_rate: null }
    ]
  });
});

test('rejects unsupported comparison dimensions before querying storage', async () => {
  await assert.rejects(() => dashboardComparisonReport({ prepare() { throw new Error('must not query'); } }, {
    tenantId: 'researchops', mode: 'country', startAtMs: 1, endAtMs: 2, model: null
  }), /unsupported_comparison_mode/);
});

test('queries only the selected bounded comparison dimension', async () => {
  const calls = [];
  const db = { prepare(sql) { return { bind(...values) { calls.push({ sql, values }); return this; }, async all() { return { results: [{ group_key: 'keyboard', label: 'Keyboard journeys', session_count: 6, interaction_count: 18, completed_session_count: 3, friction_session_count: 1 }] }; } }; } };
  const report = await dashboardComparisonReport(db, {
    tenantId: 'researchops', mode: 'interaction_mode', startAtMs: 1000, endAtMs: 2000,
    model: { model_key: 'model.researchops', version: 2 }
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /compare:interaction_mode/);
  assert.match(calls[0].sql, /json_extract\(e\.metadata_json, '\$\.pointer_type'\) = 'keyboard'/);
  assert.doesNotMatch(calls[0].sql, /input_method/);
  assert.deepEqual(calls[0].values, ['researchops', 1000, 2000, 'model.researchops', 2]);
  assert.equal(report.rows[0].completion_rate, 50);
});

test('uses one bounded, parameterised query for every supported comparison dimension', async () => {
  for (const mode of ['visit_maturity', 'outcome', 'task', 'interaction_mode']) {
    const calls = [];
    const db = {
      prepare(sql) {
        return {
          bind(...values) { calls.push({ sql, values }); return this; },
          async all() { return { results: [] }; }
        };
      }
    };
    const report = await dashboardComparisonReport(db, {
      tenantId: 'researchops', mode, startAtMs: 1000, endAtMs: 2000,
      model: { model_key: 'model.researchops', version: 2 }
    });

    assert.equal(report.mode, mode);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, new RegExp(`compare:${mode}`));
    assert.match(calls[0].sql, /start_at_ms/);
    assert.match(calls[0].sql, /end_at_ms/);
    assert.deepEqual(calls[0].values, ['researchops', 1000, 2000, 'model.researchops', 2]);
  }
});
