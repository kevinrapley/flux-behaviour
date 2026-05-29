import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reference = JSON.parse(readFileSync('config/scoring/flux-scoring-config.v6.10.reference.json', 'utf8'));
const fixtureSet = JSON.parse(readFileSync('fixtures/scoring/reference-cases/scoring-reference-cases.json', 'utf8'));

const requiredSignals = ['path_efficiency', 'submovements', 'misses_per_target', 'help_views', 'revisit_rate'];
const prohibitedInferences = new Set([
  'user competence',
  'eligibility',
  'protected characteristics',
  'user fault',
  'fraud risk',
  'low ability',
  'disability',
  'assistive technology identity'
]);

test('scoring fixtures declare reference-only purpose', () => {
  assert.equal(fixtureSet.schema_version, '1.0.0');
  assert.match(fixtureSet.purpose, /not runtime outputs/i);
  assert.equal(reference.meta.runtime_ready, false);
  assert.equal(reference.meta.status, 'reference-only');
});

test('scoring fixtures provide canonical validation cases', () => {
  assert.deepEqual(fixtureSet.cases.map((testCase) => testCase.id), [
    'balanced-journey',
    'high-friction-journey',
    'assistive-help-seeking-journey',
    'careful-checking-journey',
    'accessibility-adjacent-journey'
  ]);
});

test('scoring fixtures provide required signal ranges', () => {
  for (const testCase of fixtureSet.cases) {
    for (const signal of requiredSignals) {
      assert.equal(typeof testCase.signals[signal], 'number', `${testCase.id} missing ${signal}`);
    }
    assert.ok(testCase.signals.path_efficiency >= 0 && testCase.signals.path_efficiency <= 1);
    assert.ok(testCase.signals.revisit_rate >= 0 && testCase.signals.revisit_rate <= 1);
    assert.ok(testCase.signals.submovements >= 0);
    assert.ok(testCase.signals.misses_per_target >= 0);
    assert.ok(testCase.signals.help_views >= 0);
  }
});

test('scoring fixtures explicitly block unsafe interpretation', () => {
  for (const testCase of fixtureSet.cases) {
    assert.ok(Array.isArray(testCase.expected_interpretation.must_not_infer));
    assert.ok(testCase.expected_interpretation.must_not_infer.length > 0);
    for (const blockedInference of testCase.expected_interpretation.must_not_infer) {
      assert.ok(prohibitedInferences.has(blockedInference), `${testCase.id} has unrecognised blocked inference: ${blockedInference}`);
    }
  }
});
