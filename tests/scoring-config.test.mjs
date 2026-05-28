import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('config/scoring/flux-scoring-config.v6.10.reference.json', 'utf8'));

test('scoring reference is explicitly non-runtime', () => {
  assert.equal(config.meta.version, 'v6.10');
  assert.equal(config.meta.status, 'reference-only');
  assert.equal(config.meta.runtime_ready, false);
  assert.equal(config.interpretation_policy.service_improvement_only, true);
  assert.equal(config.interpretation_policy.dual_interpretation_required, true);
  assert.equal(config.interpretation_policy.no_user_judgement, true);
});

test('scoring reference preserves 16-dimension lineage with core and extended tiers', () => {
  assert.equal(config.dimensions.length, 16);
  const tiers = new Set(config.dimensions.map((dimension) => dimension.tier));
  assert.ok(tiers.has('core'));
  assert.ok(tiers.has('extended'));
  for (const dimension of config.dimensions) {
    assert.match(dimension.id, /^flux:/);
    assert.equal(typeof dimension.key, 'string');
    assert.equal(typeof dimension.label, 'string');
    assert.equal(typeof dimension.description, 'string');
  }
});

test('scoring reference keeps composite labels without enabling automated decisions', () => {
  assert.equal(config.composites.length, 5);
  const compositeKeys = config.composites.map((composite) => composite.key);
  assert.deepEqual(compositeKeys, [
    'momentum',
    'skill',
    'confidence_trust',
    'resilience_adaptability',
    'governance_integrity'
  ]);
  assert.equal(config.interpretation_policy.human_review_required_for_high_impact_use, true);
});
