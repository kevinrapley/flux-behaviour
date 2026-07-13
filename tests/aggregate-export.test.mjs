import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAggregateCsv, buildAggregateExport } from '../src/product/aggregate-export.mjs';

const provenance = {
  source: 'Flux Behaviour aggregate dashboard', generated_at: '2026-07-13T12:00:00.000Z', tenant_id: 'researchops',
  range: '30d', range_start: '2026-06-13T12:00:00.000Z', range_end: '2026-07-13T12:00:00.000Z',
  compare: 'period', model_key: 'model.researchops', model_version: 3, event_schema_version: '1.2.0',
  suppression_note: 'Groups smaller than 5 journeys are suppressed.', caveat: 'Aggregate service evidence; no raw events or entered values.'
};

test('builds provenance-bearing aggregate CSV without raw-event fields', () => {
  const exported = buildAggregateExport({
    report: 'fields', provenance,
    data: { fields: [{
      field_key: 'field.objective', label: 'Objective editor', required: true,
      exposed_session_count: 10, interacted_session_count: 8, coverage_rate: 80,
      dwell_distribution: { under_1s: 1, from_1_to_5s: 4 },
      length_distribution: { from_21_to_100: 6 }
    }] }
  });
  const csv = buildAggregateCsv(exported);

  assert.equal(exported.rows.some((row) => row.metric === 'dwell_under_1s' && row.value === 1), true);
  assert.equal(exported.rows.some((row) => row.metric === 'length_from_21_to_100' && row.value === 6), true);
  assert.match(csv, /Flux Behaviour aggregate dashboard/);
  assert.match(csv, /model\.researchops/);
  assert.match(csv, /event_schema_version/);
  assert.doesNotMatch(csv, /session_id|visitor_id|metadata_json|narrative|entered_value/);
});

test('neutralises spreadsheet formula prefixes in controlled labels', () => {
  const csv = buildAggregateCsv(buildAggregateExport({
    report: 'events', provenance,
    data: { events: [{ event_class: 'interaction', action: '=HYPERLINK("bad")', event_count: 6, session_count: 5, sessions_rate: 83.3 }] }
  }));

  assert.match(csv, /'=HYPERLINK/);
  assert.doesNotMatch(csv, /,"=HYPERLINK/);
});

test('preserves negative aggregate changes as numeric CSV values', () => {
  const csv = buildAggregateCsv(buildAggregateExport({
    report: 'events', provenance,
    data: { events: [{ event_class: 'interaction', action: 'control.click', event_count: 6, session_count: 5, event_count_change: -25 }] }
  }));

  assert.match(csv, /"event_count_change","-25"/);
  assert.doesNotMatch(csv, /"'-25"/);
});

test('rejects unsupported or raw export report names', () => {
  assert.throws(() => buildAggregateExport({ report: 'raw_events', provenance, data: {} }), /unsupported_export_report/);
});
