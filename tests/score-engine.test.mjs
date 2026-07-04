import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createScoreEngine } from '../demo/assets/flux-score-engine.mjs';
import { computeCharsPerMinute } from '../demo/assets/flux-field-capture.js';

const reference = JSON.parse(
  readFileSync('config/scoring/flux-scoring-config.v6.10.reference.json', 'utf8')
);
const params = reference.engine_reference;
const dimensions = [{ key: 'eff', label: 'Efficiency' }, { key: 'frustration', label: 'Frustration' }];

function engine() {
  return createScoreEngine({ dimensions, params });
}

test('scores start at the reference neutral value', () => {
  const scores = engine().snapshot();
  assert.equal(scores.eff, params.neutral);
  assert.equal(scores.frustration, params.neutral);
});

test('a stimulus moves only the stimulated dimension, rate-limited per second', () => {
  const scoring = engine();
  scoring.stimulus('eff', 100);
  scoring.tick(1);

  const scores = scoring.snapshot();
  assert.ok(scores.eff > params.neutral, 'stimulated dimension rises');
  assert.ok(
    scores.eff <= params.neutral + params.max_change_per_second,
    'rise is capped by max_change_per_second'
  );
  assert.equal(scores.frustration, params.neutral, 'other dimensions stay neutral');
});

test('scores decay toward neutral when stimuli stop', () => {
  const scoring = engine();
  for (let i = 0; i < 10; i += 1) {
    scoring.stimulus('eff', 10);
    scoring.tick(0.5);
  }
  const raised = scoring.snapshot().eff;
  assert.ok(raised > params.neutral + 5, 'sustained stimuli raise the score');

  for (let i = 0; i < 200; i += 1) {
    scoring.tick(0.5);
  }
  const decayed = scoring.snapshot().eff;
  assert.ok(Math.abs(decayed - params.neutral) < 1, `decays toward neutral, got ${decayed}`);
});

test('scores stay inside the reference bounds under extreme stimuli', () => {
  const scoring = engine();
  for (let i = 0; i < 500; i += 1) {
    scoring.stimulus('eff', 1000);
    scoring.stimulus('frustration', -1000);
    scoring.tick(1);
  }
  const scores = scoring.snapshot();
  assert.ok(scores.eff <= params.bounds[1]);
  assert.ok(scores.frustration >= params.bounds[0]);
});

test('sub-deadband noise does not move scores', () => {
  const scoring = engine();
  for (let i = 0; i < 20; i += 1) {
    scoring.stimulus('eff', params.deadband_abs / 10);
    scoring.tick(1);
  }
  assert.equal(scoring.snapshot().eff, params.neutral);
});

test('typing speed calculator is bounded and needs real typing', () => {
  assert.equal(computeCharsPerMinute(0, 0), 0);
  assert.equal(computeCharsPerMinute(1, 500), 0);
  assert.equal(computeCharsPerMinute(60, 60000), 60);
  assert.equal(computeCharsPerMinute(10000, 1), 2000);
});
