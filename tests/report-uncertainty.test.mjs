import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGovernanceReport, buildUncertaintyReport, wilsonInterval } from '../src/product/report-uncertainty.mjs';

test('calculates bounded Wilson 95% intervals with explicit sample evidence', () => {
  assert.deepEqual(wilsonInterval(5, 10), { lower: 23.7, upper: 76.3 });
  assert.deepEqual(wilsonInterval(0, 10), { lower: 0, upper: 27.8 });
  assert.equal(wilsonInterval(0, 0), null);

  const report = buildUncertaintyReport({
    visitor_count: 10, returning_visitor_count: 4,
    session_count: 20, completed_session_count: 12, friction_session_count: 3
  });
  assert.equal(report.method, 'wilson_95');
  assert.equal(report.rates[0].rate, 40);
  assert.equal(report.rates[1].denominator, 20);
  assert.equal(report.rates[1].interpretation, 'Wide interval — use caution');
  assert.match(report.note, /collection gaps/);
  assert.match(report.note, /repeated sessions from the same visitor/);
});

test('omits rate claims without a denominator and clamps inconsistent counts', () => {
  assert.deepEqual(buildUncertaintyReport({}).rates, []);
  const report = buildUncertaintyReport({ visitor_count: 3, returning_visitor_count: 8 });
  assert.equal(report.rates[0].numerator, 3);
  assert.equal(report.rates[0].rate, 100);
});

test('builds an aggregate governance report with explicit unknown controls', () => {
  const report = buildGovernanceReport({
    realtime: { freshness_status: 'delayed', latest_accepted_at_ms: 1000, freshness_ms: 72000 },
    serviceModel: {
      model_key: 'model.researchops', version: 2,
      coverage: { mapping_rate: 75, resolved_event_count: 15, event_count: 20, unmapped_event_count: 5, retired_model_event_count: 2 }
    },
    eventSchemaVersion: '1.2.0'
  });

  assert.deepEqual(report.controls.map((control) => control.key), ['freshness', 'semantic_coverage', 'versions', 'export']);
  assert.equal(report.controls[0].status, 'Delayed');
  assert.match(report.controls[0].evidence, /72 seconds/);
  assert.match(report.controls[1].evidence, /15 of 20/);
  assert.match(report.controls[2].evidence, /schema 1\.2\.0/);
  assert.match(report.boundary, /never exposes visitor identifiers/);
  assert.equal(report.limitations.some((item) => item.includes('Consent-choice rates')), true);
});

test('does not present empty selected-period model coverage as a zero-percent failure', () => {
  const report = buildGovernanceReport({
    realtime: {},
    serviceModel: {
      model_key: 'model.researchops', version: 2,
      coverage: { mapping_rate: 0, resolved_event_count: 0, event_count: 0, unmapped_event_count: 0, retired_model_event_count: 0 }
    },
    eventSchemaVersion: '1.2.0'
  });
  const coverage = report.controls.find((control) => control.key === 'semantic_coverage');
  assert.equal(coverage.status, 'Unavailable');
  assert.match(coverage.evidence, /No interactions were recorded/);
});
