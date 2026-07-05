import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreEngine } from '../demo/assets/flux-score-engine.mjs';
import { applyAutoNudges } from '../demo/assets/flux-nudges.js';
import { isCreditableValue, isActiveDwell } from '../demo/assets/flux-behaviour-signals.js';
import { engineParams, dimensions } from '../demo/data/playground-model.mjs';

const T0 = 1000000;

function engine() {
  return createScoreEngine({ dimensions, params: engineParams, now: T0 });
}

function run(signal, times = 3) {
  const scoring = engine();
  for (let i = 1; i <= times; i += 1) {
    applyAutoNudges(scoring, signal, T0 + i * 1000);
  }
  return scoring.snapshot();
}

// A recording stub: captures every delta a signal applies, per dimension.
function recordDeltas(signal) {
  const deltas = new Map();
  const record = (key, delta) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    if (!deltas.has(key)) deltas.set(key, []);
    deltas.get(key).push(delta);
  };
  const stub = {
    apply: (key, delta) => record(key, delta),
    nudge(map) { for (const [k, d] of Object.entries(map || {})) record(k, Number(d || 0)); },
    backOrSkip() { record('efficiency', -1.8); record('wayfinding', -1.1); }
  };
  applyAutoNudges(stub, signal, T0);
  return deltas;
}

const ALL_SIGNALS = [
  { type: 'act', metric: 'rage' },
  { type: 'act', metric: 'tabs', nav: { dir: 'forward' }, creditable: true },
  { type: 'act', metric: 'tabs', nav: { dir: 'forward' }, creditable: false },
  { type: 'act', metric: 'tabs', nav: { dir: 'skip' }, creditable: false },
  { type: 'act', metric: 'clicksBetween', nav: { dir: 'forward' }, creditable: true },
  { type: 'act', metric: 'clicksBetween', nav: { dir: 'back' }, creditable: false },
  { type: 'act', metric: 'streak3', method: 'tab' },
  { type: 'act', metric: 'passiveTabs', value: 3 },
  { type: 'act', metric: 'autocomplete' },
  { type: 'act', metric: 'shortcut' },
  { type: 'edit', metric: 'undo' },
  { type: 'time', metric: 'fieldDwell', value: 10, active: false },
  { type: 'time', metric: 'fieldDwell', value: 10, active: true },
  { type: 'time', metric: 'idleEpisode', value: 8 },
  { type: 'field', metric: 'revisit', value: 3 },
  { type: 'edit', metric: 'corrections', value: 5 },
  { type: 'edit', metric: 'typing', value: 200 },
  { type: 'edit', metric: 'paste' },
  { type: 'trust', metric: 'assuranceTick' },
  { type: 'trust', metric: 'assuranceTickRushed' },
  { type: 'trust', metric: 'passwordReveal' },
  { type: 'trust', metric: 'passwordHide' },
  { type: 'trust', metric: 'passwordToggleBurst' },
  { type: 'lookup', metric: 'start' },
  { type: 'lookup', metric: 'retry' },
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
  { type: 'pointer', metric: 'ndAttempt', path_efficiency: 0.95, submovements: 3, misses_per_target: 0, aimed: true, band: 'GREEN' },
  { type: 'pointer', metric: 'ndAttempt', path_efficiency: 0, submovements: 1, misses_per_target: 2, aimed: false, band: 'RED' }
];

test('no signal pushes one dimension in both directions', () => {
  for (const signal of ALL_SIGNALS) {
    const deltas = recordDeltas(signal);
    for (const [key, values] of deltas.entries()) {
      const hasPositive = values.some((v) => v > 0);
      const hasNegative = values.some((v) => v < 0);
      assert.ok(
        !(hasPositive && hasNegative),
        `${signal.type}.${signal.metric} pushes ${key} both up (${values}) and down`
      );
    }
  }
});

test('aimless tab-hunting does not build ICT Level or soothe frustration', () => {
  const deltas = recordDeltas({ type: 'act', metric: 'tabs', nav: { dir: 'forward' }, creditable: false });
  assert.equal(deltas.has('ict'), false, 'no ICT credit for empty tabbing');
  assert.equal(deltas.has('frustration'), false, 'no soothing for empty tabbing');

  const creditable = recordDeltas({ type: 'act', metric: 'tabs', nav: { dir: 'forward' }, creditable: true });
  assert.ok(creditable.get('ict')?.some((v) => v > 0), 'creditable tabbing earns ICT');
  assert.ok(creditable.get('frustration')?.some((v) => v < 0), 'creditable tabbing soothes');
});

test('passive tab streaks lower wayfinding instead of raising it', () => {
  const scores = run({ type: 'act', metric: 'passiveTabs', value: 3 }, 4);
  assert.ok(scores.wayfinding < engineParams.neutral, `wayfinding fell: ${scores.wayfinding}`);
  assert.ok(scores.cogload > engineParams.neutral, `cogload rose: ${scores.cogload}`);
});

test('undo is a correction signal, not tool fluency', () => {
  const deltas = recordDeltas({ type: 'edit', metric: 'undo' });
  assert.equal(deltas.has('ict'), false, 'undo earns no ICT');
  assert.ok(deltas.get('proficiency')?.every((v) => v < 0), 'undo dents proficiency');
  assert.ok(deltas.get('frustration')?.every((v) => v > 0), 'undo raises frustration');

  const scores = run({ type: 'edit', metric: 'undo' }, 4);
  assert.ok(scores.proficiency < engineParams.neutral);
});

test('long dwell while composing is engagement, not struggle', () => {
  const composing = run({ type: 'time', metric: 'fieldDwell', value: 12, active: true }, 3);
  assert.ok(composing.engagement > engineParams.neutral, `composing engages: ${composing.engagement}`);
  assert.equal(composing.efficiency, engineParams.neutral, 'no efficiency penalty for writing');

  const stuck = run({ type: 'time', metric: 'fieldDwell', value: 12, active: false }, 3);
  assert.ok(stuck.cogload > composing.cogload, 'inactive dwell loads more than composing');
  assert.ok(stuck.efficiency < engineParams.neutral, 'inactive dwell dents efficiency');
});

test('rushed assurance ticking earns less trust and marks confirmation bias', () => {
  const considered = run({ type: 'trust', metric: 'assuranceTick' }, 3);
  const rushed = run({ type: 'trust', metric: 'assuranceTickRushed' }, 3);
  assert.ok(rushed.trust < considered.trust, `rushed trust ${rushed.trust} < considered ${considered.trust}`);
  assert.ok(rushed.cogbias < engineParams.neutral, `rushed ticking dents bias sensitivity: ${rushed.cogbias}`);
});

test('password toggle bursts read as anxiety, single reveals as verification', () => {
  const reveal = run({ type: 'trust', metric: 'passwordReveal' }, 3);
  assert.ok(reveal.epistemic > engineParams.neutral);

  const burst = run({ type: 'trust', metric: 'passwordToggleBurst' }, 3);
  assert.ok(burst.epistemic < engineParams.neutral, `burst dents epistemic: ${burst.epistemic}`);
  assert.ok(burst.frustration > engineParams.neutral, `burst raises frustration: ${burst.frustration}`);
});

test('failed lookup retries are struggle, not engagement', () => {
  const deltas = recordDeltas({ type: 'lookup', metric: 'retry' });
  assert.equal(deltas.has('engagement'), false, 'retry earns no engagement');
  const scores = run({ type: 'lookup', metric: 'retry' }, 3);
  assert.ok(scores.wayfinding < engineParams.neutral);
  assert.ok(scores.cogload > engineParams.neutral);
});

test('typing feeds engagement at any sustained speed', () => {
  for (const cpm of [40, 100, 250]) {
    const deltas = recordDeltas({ type: 'edit', metric: 'typing', value: cpm });
    assert.ok(deltas.get('engagement')?.every((v) => v > 0), `cpm ${cpm} engages`);
  }
});

test('creditable value rules fit real GOV.UK components', () => {
  assert.equal(isCreditableValue({ value: '9', inputMode: 'numeric' }), true, 'one digit date part');
  assert.equal(isCreditableValue({ value: 'a', inputMode: null }), false, 'one char free text');
  assert.equal(isCreditableValue({ value: 'ok', inputMode: null }), true);
  assert.equal(isCreditableValue({ value: '  ', inputMode: 'numeric' }), false);
  assert.equal(isCreditableValue({ value: '!!', inputMode: null }), false, 'no alphanumeric content');
});

test('active dwell requires real typing for the time spent', () => {
  assert.equal(isActiveDwell(30, 20), true, 'composing');
  assert.equal(isActiveDwell(0, 20), false, 'staring');
  assert.equal(isActiveDwell(3, 20), false, 'a few keys over a long stare');
  assert.equal(isActiveDwell(2, 3), true, 'short dwell with a couple of keys');
});
