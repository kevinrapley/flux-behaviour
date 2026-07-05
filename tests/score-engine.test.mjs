import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreEngine } from '../demo/assets/flux-score-engine.mjs';
import { applyAutoNudges } from '../demo/assets/flux-nudges.js';
import { bandForNd, computeKinematics, computeCharsPerMinute } from '../demo/assets/flux-behaviour-signals.js';
import { engineParams, uiScoreBands, ndBand, dimensions, personas } from '../demo/data/playground-model.mjs';
import { computeCharsPerMinute as journeyCpm } from '../demo/assets/flux-field-capture.js';

const T0 = 1000000;

function engine() {
  return createScoreEngine({ dimensions, params: engineParams, now: T0 });
}

test('all 20 dimensions start at neutral', () => {
  const scores = engine().snapshot();
  assert.equal(Object.keys(scores).length, dimensions.length);
  for (const dimension of dimensions) {
    assert.equal(scores[dimension.key], engineParams.neutral, dimension.key);
  }
});

test('a single event visibly moves its dimension (event-driven ticks)', () => {
  const scoring = engine();
  scoring.apply('cogload', 3, T0 + 1000);
  const scores = scoring.snapshot();
  assert.ok(scores.cogload > engineParams.neutral, `cogload moved: ${scores.cogload}`);
});

test('rapid events are rate-limited by time between applies', () => {
  const scoring = engine();
  let t = T0 + 1000;
  scoring.apply('efficiency', 50, t);
  const afterFirst = scoring.snapshot().efficiency;
  for (let i = 0; i < 10; i += 1) {
    t += 100;
    scoring.apply('efficiency', 50, t);
  }
  const afterBurst = scoring.snapshot().efficiency;
  // Ten applies over one second can add at most max_change_per_second.
  assert.ok(afterBurst - afterFirst <= engineParams.max_change_per_second + 0.001,
    `burst gain ${afterBurst - afterFirst} within rate limit`);
});

test('scores decay toward neutral over time', () => {
  const scoring = engine();
  scoring.apply('engagement', 40, T0 + 1000);
  const raised = scoring.snapshot().engagement;
  assert.ok(raised > engineParams.neutral);

  for (let i = 1; i <= 600; i += 1) {
    scoring.decay(T0 + 1000 + i * 1000);
  }
  const decayed = scoring.snapshot().engagement;
  assert.ok(Math.abs(decayed - engineParams.neutral) < 1, `decayed to ${decayed}`);
});

test('scores stay inside bounds under extreme stimuli', () => {
  const scoring = engine();
  let t = T0 + 1000;
  for (let i = 0; i < 100; i += 1) {
    t += 2000;
    scoring.apply('ethics', -1000, t);
    scoring.apply('efficiency', 1000, t);
  }
  const scores = scoring.snapshot();
  assert.ok(scores.ethics >= engineParams.bounds[0]);
  assert.ok(scores.efficiency <= engineParams.bounds[1]);
});

test('frustration uses the dual-channel virtual model', () => {
  const scoring = engine();
  let t = T0 + 1000;
  for (let i = 0; i < 5; i += 1) {
    t += 1000;
    scoring.apply('frustration', 4, t);
  }
  const raised = scoring.snapshot().frustration;
  assert.ok(raised > engineParams.neutral, `rage pressure raises frustration: ${raised}`);

  for (let i = 0; i < 5; i += 1) {
    t += 1000;
    scoring.apply('frustration', -1.2, t);
  }
  const soothed = scoring.snapshot().frustration;
  assert.ok(soothed < raised, `soothing lowers frustration: ${soothed} < ${raised}`);
});

test('back or skip navigation applies a burst-limited penalty', () => {
  const scoring = engine();
  let t = T0 + 1000;
  for (let i = 0; i < 10; i += 1) {
    t += 400;
    scoring.backOrSkip(t);
  }
  const scores = scoring.snapshot();
  assert.ok(scores.efficiency < engineParams.neutral);
  assert.ok(scores.wayfinding < engineParams.neutral);
  // Burst limit: no more than 4 penalties per 10 seconds.
  assert.ok(scores.efficiency > engineParams.neutral - 4 * 1.8);
});

test('opening help raises cognitive load and adaptability', () => {
  const scoring = engine();
  applyAutoNudges(scoring, { type: 'assist', metric: 'help' }, T0 + 1000);
  const scores = scoring.snapshot();
  assert.ok(scores.cogload > engineParams.neutral, `cogload responds to help: ${scores.cogload}`);
  assert.ok(scores.adaptability > engineParams.neutral);
  assert.ok(scores.epistemic < engineParams.neutral);
});

test('every mapped behaviour moves at least one dimension', () => {
  const signals = [
    { type: 'act', metric: 'rage' },
    { type: 'act', metric: 'tabs', nav: { dir: 'forward' }, creditable: true },
    { type: 'act', metric: 'clicksBetween', nav: { dir: 'forward' }, creditable: true },
    { type: 'act', metric: 'streak3', method: 'tab' },
    { type: 'act', metric: 'autocomplete' },
    { type: 'act', metric: 'shortcut' },
    { type: 'time', metric: 'fieldDwell', value: 9 },
    { type: 'time', metric: 'idleEpisode', value: 8 },
    { type: 'field', metric: 'revisit', value: 3 },
    { type: 'edit', metric: 'corrections', value: 5 },
    { type: 'edit', metric: 'typing', value: 200 },
    { type: 'edit', metric: 'paste' },
    { type: 'trust', metric: 'assuranceTick' },
    { type: 'trust', metric: 'passwordReveal' },
    { type: 'lookup', metric: 'start' },
    { type: 'lookup', metric: 'select' },
    { type: 'assist', metric: 'help' },
    { type: 'error', metric: 'invalid' },
    { type: 'error', metric: 'recovered' },
    { type: 'flow', metric: 'submit' },
    { type: 'handoff', metric: 'note' },
    { type: 'context', metric: 'note' },
    { type: 'policy', metric: 'breach' },
    { type: 'oversight', metric: 'ack' },
    { type: 'fatigue', metric: 'mark' },
    { type: 'pointer', metric: 'ndAttempt', path_efficiency: 0.2, submovements: 60, misses_per_target: 3, band: 'RED' }
  ];

  for (const signal of signals) {
    const scoring = engine();
    // Behaviours repeat in a real session; small nudges accumulate through
    // the EMA until they clear the deadband, as in the original engine.
    for (let i = 1; i <= 3; i += 1) {
      applyAutoNudges(scoring, signal, T0 + i * 1000);
    }
    const scores = scoring.snapshot();
    const moved = dimensions.some((d) => Math.abs(scores[d.key] - engineParams.neutral) > 0.01);
    assert.ok(moved, `${signal.type}.${signal.metric} moved at least one dimension`);
  }
});

test('positive credit is withheld on back and skip navigation', () => {
  const scoring = engine();
  for (let i = 1; i <= 8; i += 1) {
    applyAutoNudges(scoring, { type: 'act', metric: 'tabs', nav: { dir: 'skip' }, creditable: false }, T0 + i * 1000);
  }
  const scores = scoring.snapshot();
  assert.ok(scores.efficiency < engineParams.neutral, `efficiency fell: ${scores.efficiency}`);
  assert.ok(scores.proficiency < engineParams.neutral, `proficiency fell: ${scores.proficiency}`);
  assert.ok(scores.wayfinding < engineParams.neutral, `wayfinding fell: ${scores.wayfinding}`);

  // The same behaviour with creditable input on a forward move earns credit.
  const forward = engine();
  for (let i = 1; i <= 3; i += 1) {
    applyAutoNudges(forward, { type: 'act', metric: 'tabs', nav: { dir: 'forward' }, creditable: true }, T0 + i * 1000);
  }
  assert.ok(forward.snapshot().efficiency > engineParams.neutral);
});

test('policy breach heavily penalises ethics and trust alignment', () => {
  const scoring = engine();
  let t = T0 + 1000;
  for (let i = 0; i < 3; i += 1) {
    t += 2000;
    applyAutoNudges(scoring, { type: 'policy', metric: 'breach' }, t);
  }
  const scores = scoring.snapshot();
  assert.ok(scores.ethics < 45, `ethics fell: ${scores.ethics}`);
  assert.ok(scores.trust_align < engineParams.neutral);
});

test('persona replays move their target dimensions', () => {
  for (const [name, deltas] of Object.entries(personas)) {
    const scoring = engine();
    scoring.nudge(deltas, T0 + 1000);
    const scores = scoring.snapshot();
    const [firstKey, firstDelta] = Object.entries(deltas)[0];
    if (firstDelta > 0) assert.ok(scores[firstKey] > engineParams.neutral, `${name}: ${firstKey} rose`);
    else assert.ok(scores[firstKey] < engineParams.neutral, `${name}: ${firstKey} fell`);
  }
});

test('nd banding follows the v6.10 thresholds with miss adjustment', () => {
  assert.equal(bandForNd({ path_efficiency: 0.9, submovements: 5, misses_per_target: 0 }, ndBand), 'GREEN');
  assert.equal(bandForNd({ path_efficiency: 0.9, submovements: 5, misses_per_target: 1 }, ndBand), 'GREEN');
  assert.equal(bandForNd({ path_efficiency: 0.9, submovements: 5, misses_per_target: 10 }, ndBand), 'RED');
  assert.equal(bandForNd({ path_efficiency: 0.5, submovements: 30, misses_per_target: 0 }, ndBand), 'AMBER');
  assert.equal(bandForNd({ path_efficiency: 0.2, submovements: 80, misses_per_target: 0 }, ndBand), 'RED');
  assert.equal(bandForNd({ path_efficiency: 0.9, submovements: 5, misses_per_target: 3 }, ndBand), 'AMBER');
});

test('pointer kinematics: straight paths are efficient, zigzags count submovements', () => {
  const straight = Array.from({ length: 20 }, (_, i) => ({ x: i * 20, y: 0, t: i * 10 }));
  const straightMetrics = computeKinematics(straight);
  assert.ok(straightMetrics.aimed, 'a long steady approach is an aimed acquisition');
  assert.ok(straightMetrics.path_efficiency > 0.95);
  assert.ok(straightMetrics.submovements <= 2);

  const zigzag = Array.from({ length: 20 }, (_, i) => ({ x: i * 10, y: i % 2 === 0 ? 0 : 40, t: i * 10 }));
  const zigzagMetrics = computeKinematics(zigzag);
  assert.ok(
    zigzagMetrics.path_efficiency < ndBand.efficiency.green_min,
    `zigzag efficiency ${zigzagMetrics.path_efficiency} stays below the green threshold`
  );
  assert.ok(zigzagMetrics.submovements > 5, `zigzag submovements counted: ${zigzagMetrics.submovements}`);
});

test('stationary and twitch clicks are unaimed and score zero efficiency', () => {
  assert.deepEqual(computeKinematics([]), { path_efficiency: 0, submovements: 1, duration_ms: 0, aimed: false });
  assert.equal(computeKinematics([{ x: 100, y: 100, t: 0 }]).aimed, false);

  // A rapid re-click with a few pixels of drift: no aiming task happened.
  const twitch = [
    { x: 100, y: 100, t: 0 },
    { x: 102, y: 101, t: 20 },
    { x: 101, y: 103, t: 40 }
  ];
  const metrics = computeKinematics(twitch);
  assert.equal(metrics.aimed, false);
  assert.equal(metrics.path_efficiency, 0);
});

test('rage clicking cannot raise efficiency (coherence regression)', () => {
  const scoring = engine();
  let t = T0 + 1000;

  // A rage burst as the page would emit it: three unaimed acquisitions on
  // the same control, then the rage signal itself.
  for (let i = 0; i < 3; i += 1) {
    t += 150;
    applyAutoNudges(scoring, {
      type: 'pointer',
      metric: 'ndAttempt',
      path_efficiency: 0,
      submovements: 1,
      misses_per_target: 0,
      aimed: false,
      band: 'RED'
    }, t);
  }
  t += 50;
  applyAutoNudges(scoring, { type: 'act', metric: 'rage' }, t);

  const scores = scoring.snapshot();
  assert.ok(scores.efficiency < engineParams.neutral, `efficiency fell under rage: ${scores.efficiency}`);
  assert.ok(scores.frustration > engineParams.neutral, `frustration rose under rage: ${scores.frustration}`);
});

test('unaimed clicks earn no efficiency credit; aimed direct clicks do', () => {
  const unaimed = engine();
  for (let i = 1; i <= 5; i += 1) {
    applyAutoNudges(unaimed, {
      type: 'pointer', metric: 'ndAttempt',
      path_efficiency: 0, submovements: 1, misses_per_target: 0, aimed: false, band: 'RED'
    }, T0 + i * 500);
  }
  assert.equal(unaimed.snapshot().efficiency, engineParams.neutral);

  const aimed = engine();
  for (let i = 1; i <= 5; i += 1) {
    applyAutoNudges(aimed, {
      type: 'pointer', metric: 'ndAttempt',
      path_efficiency: 0.95, submovements: 3, misses_per_target: 0, aimed: true, band: 'GREEN'
    }, T0 + i * 500);
  }
  assert.ok(aimed.snapshot().efficiency > engineParams.neutral);
});

test('score bands match the reference values', () => {
  assert.equal(uiScoreBands.green_min, 70);
  assert.equal(uiScoreBands.amber_min, 40);
});

test('typing speed calculators agree and stay bounded', () => {
  assert.equal(computeCharsPerMinute(0, 0), 0);
  assert.equal(computeCharsPerMinute(60, 60000), 60);
  assert.equal(computeCharsPerMinute(10000, 1), 2000);
  assert.equal(computeCharsPerMinute(60, 60000), journeyCpm(60, 60000));
});
