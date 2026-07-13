import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildFieldReport, buildFunnelReport, dashboardFunnelFieldReports } from '../src/product/funnel-field-reports.mjs';

const model = {
  entities: [
    { key: 'service.example', type: 'service', label: 'Example', position: 1 },
    { key: 'transaction.apply', type: 'transaction', label: 'Apply', parent_key: 'service.example', position: 1 },
    { key: 'task.details', type: 'task', label: 'Provide details', parent_key: 'transaction.apply', position: 1 },
    { key: 'step.start', type: 'step', label: 'Start application', parent_key: 'task.details', position: 1 },
    { key: 'step.review', type: 'step', label: 'Review application', parent_key: 'task.details', position: 2 }
  ]
};

test('builds ordered transaction funnels with explicit completion, abandonment and recovery denominators', () => {
  const report = buildFunnelReport({
    model,
    summaries: [{
      transaction_key: 'transaction.apply', started_session_count: 10, completed_session_count: 6,
      failed_session_count: 1, abandoned_session_count: 2, in_progress_session_count: 1,
      friction_session_count: 4, recovered_session_count: 3, median_completion_ms: 90000,
      p90_completion_ms: 180000
    }],
    steps: [
      { transaction_key: 'transaction.apply', step_key: 'step.start', session_count: 10 },
      { transaction_key: 'transaction.apply', step_key: 'step.review', session_count: 7 }
    ],
    previousSummaries: [{ transaction_key: 'transaction.apply', started_session_count: 8, completed_session_count: 4 }]
  });

  assert.deepEqual(report.transactions[0], {
    transaction_key: 'transaction.apply', label: 'Apply', started_session_count: 10,
    completed_session_count: 6, completion_rate: 60, failed_session_count: 1,
    failure_rate: 10, abandoned_session_count: 2, abandonment_rate: 20,
    in_progress_session_count: 1, friction_session_count: 4, recovered_session_count: 3,
    recovery_rate: 75, median_completion_ms: 90000, p90_completion_ms: 180000,
    previous_completion_rate: 50, completion_rate_change: 10,
    steps: [
      { step_key: 'step.start', label: 'Start application', position: 1, session_count: 10, reach_rate: 100, previous_step_session_count: 10, step_dropoff_count: 0, step_dropoff_rate: 0 },
      { step_key: 'step.review', label: 'Review application', position: 2, session_count: 7, reach_rate: 70, previous_step_session_count: 10, step_dropoff_count: 3, step_dropoff_rate: 30 }
    ]
  });
});

test('keeps configured transactions visible when no journey has started', () => {
  const configuredModel = {
    entities: [
      ...model.entities,
      { key: 'transaction.empty', type: 'transaction', label: 'Empty journey', parent_key: 'service.example', position: 2 }
    ]
  };

  const report = buildFunnelReport({ model: configuredModel });

  assert.equal(report.transactions.length, 2);
  assert.deepEqual(report.transactions[1], {
    transaction_key: 'transaction.empty', label: 'Empty journey', started_session_count: 0,
    completed_session_count: 0, completion_rate: 0, failed_session_count: 0, failure_rate: 0,
    abandoned_session_count: 0, abandonment_rate: 0, in_progress_session_count: 0,
    friction_session_count: 0, recovered_session_count: 0, recovery_rate: 0,
    median_completion_ms: 0, p90_completion_ms: 0, previous_completion_rate: null,
    completion_rate_change: null, steps: []
  });
});

test('distinguishes all-time reports from a comparable period with zero activity', () => {
  const funnels = buildFunnelReport({
    model,
    comparisonAvailable: false,
    summaries: [{ transaction_key: 'transaction.apply', started_session_count: 2, completed_session_count: 1 }]
  });
  const fields = buildFieldReport({
    comparisonAvailable: false,
    rows: [{ field_key: 'field.objective', label: 'Objective editor', exposed_session_count: 2, interacted_session_count: 1 }]
  });

  assert.equal(funnels.comparison_available, false);
  assert.equal(funnels.transactions[0].previous_completion_rate, null);
  assert.equal(funnels.transactions[0].completion_rate_change, null);
  assert.equal(fields.comparison_available, false);
  assert.equal(fields.fields[0].previous_coverage_rate, null);
  assert.equal(fields.fields[0].coverage_rate_change, null);
});

test('authenticated dashboard includes funnel and field reports', () => {
  const router = readFileSync('src/product/router.mjs', 'utf8');

  assert.match(router, /dashboardFunnelFieldReports/);
  assert.match(router, /funnel_report: reports\.funnels/);
  assert.match(router, /field_report: reports\.fields/);
});

test('queries exact-version funnels and field coverage for current and previous periods', async () => {
  const calls = [];
  const db = { prepare(sql) { return { bind(...values) { calls.push({ sql, values }); return this; }, async all() {
    if (sql.includes('report-funnels:current')) return { results: [{ transaction_key: 'transaction.apply', started_session_count: 2, completed_session_count: 1 }] };
    if (sql.includes('report-funnels:previous')) return { results: [] };
    if (sql.includes('report-funnel-steps:current')) return { results: [{ transaction_key: 'transaction.apply', step_key: 'step.start', session_count: 2 }] };
    if (sql.includes('report-fields:current')) return { results: [{ field_key: 'field.objective', label: 'Objective', required: 1, exposed_session_count: 2, interacted_session_count: 1 }] };
    if (sql.includes('report-fields:previous')) return { results: [] };
    throw new Error(`Unexpected query: ${sql}`);
  } }; } };
  const reportModel = {
    model_key: 'model.example', version: 4,
    entities: [
      { key: 'service.example', type: 'service', label: 'Example', position: 1 },
      { key: 'transaction.apply', type: 'transaction', label: 'Apply', parent_key: 'service.example', position: 1 },
      { key: 'task.details', type: 'task', label: 'Details', parent_key: 'transaction.apply', position: 1 },
      { key: 'step.start', type: 'step', label: 'Start', parent_key: 'task.details', position: 1 }
    ]
  };

  const result = await dashboardFunnelFieldReports(db, {
    tenantId: 'researchops', model: reportModel,
    startAtMs: 1000, endAtMs: 2000, previousStartAtMs: 0, previousEndAtMs: 1000
  });

  assert.equal(result.funnels.transactions[0].label, 'Apply');
  assert.equal(result.fields.fields[0].label, 'Objective');
  assert.equal(calls.length, 5);
  assert.ok(calls.every(({ values }) => values.includes('model.example') && values.includes(4)));
  assert.ok(calls.some(({ sql, values }) => sql.includes('report-funnels:current') && values.includes(2000 - 1800000)));
  const funnelQuery = calls.find(({ sql }) => sql.includes('report-funnels:current'));
  assert.match(funnelQuery.sql, /INNER JOIN sessions/);
  assert.match(funnelQuery.sql, /last_success_at_ms/);
  assert.deepEqual(funnelQuery.values.slice(0, 6), ['researchops', 1000, 2000, 'model.example', 4, 'researchops']);
  const stepQuery = calls.find(({ sql }) => sql.includes('report-funnel-steps:current'));
  assert.match(stepQuery.sql, /WITH RECURSIVE/);
  assert.match(stepQuery.sql, /qualified_steps/);
  const fieldQuery = calls.find(({ sql }) => sql.includes('report-fields:current'));
  assert.match(fieldQuery.sql, /success_at_ms > fs\.first_interacted_at_ms/);
  assert.match(fieldQuery.sql, /ROW_NUMBER\(\) OVER \(PARTITION BY field_key, session_id ORDER BY occurred_at_ms DESC, id DESC\)/);
  assert.deepEqual(calls.find(({ sql }) => sql.includes('report-funnel-steps:current')).values, ['researchops', 'model.example', 4, 'researchops', 1000, 2000, 'model.example', 4]);
});

test('builds privacy-safe field coverage, validation, dwell and length distributions', () => {
  const report = buildFieldReport({
    rows: [{
      field_key: 'field.objective', label: 'Objective editor', required: 1, complexity: 5,
      exposed_session_count: 10, interacted_session_count: 7, edited_session_count: 6,
      validation_session_count: 2, required_skip_attempt_session_count: 1,
      successful_outcome_session_count: 5, correction_count: 8,
      dwell_under_1s: 1, dwell_1_5s: 3, dwell_5_15s: 2, dwell_15_60s: 1, dwell_over_60s: 0,
      length_empty: 0, length_1_20: 1, length_21_100: 3, length_101_500: 2, length_over_500: 0
    }],
    previousRows: [{ field_key: 'field.objective', exposed_session_count: 8, interacted_session_count: 4 }]
  });

  assert.deepEqual(report.fields[0], {
    field_key: 'field.objective', label: 'Objective editor', required: true, complexity: 5,
    exposed_session_count: 10, interacted_session_count: 7, coverage_rate: 70,
    non_interaction_session_count: 3, edited_session_count: 6, edited_completion_rate: 60,
    validation_session_count: 2, validation_rate: 28.6, required_skip_attempt_session_count: 1,
    successful_outcome_session_count: 5, successful_outcome_rate: 71.4, correction_count: 8,
    dwell_distribution: { under_1s: 1, from_1_to_5s: 3, from_5_to_15s: 2, from_15_to_60s: 1, over_60s: 0 },
    length_distribution: { empty: 0, from_1_to_20: 1, from_21_to_100: 3, from_101_to_500: 2, over_500: 0 },
    previous_coverage_rate: 50, coverage_rate_change: 20
  });
});
