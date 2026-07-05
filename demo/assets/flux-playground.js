import { installFluxBrowserTag, createBrowserTransport } from '/assets/flux/sdk/flux-browser.mjs';
import { createScoreEngine } from '/assets/demo/flux-score-engine.mjs';
import { applyAutoNudges } from '/assets/demo/flux-nudges.js';
import { instrumentBehaviour } from '/assets/demo/flux-behaviour-signals.js';
import { createScoreBars, createScoreLines } from '/assets/demo/flux-score-charts.js';
import { initPointerViz } from '/assets/demo/flux-pointer-viz.js';

const config = JSON.parse(document.getElementById('flux-playground-config').textContent);
const { dimensions, params, bands, ndBand, personas, composites: compositeDefs } = config;

const endpoint = document.querySelector('script[data-flux-endpoint]')?.dataset?.fluxEndpoint
  ?? 'http://127.0.0.1:8787/collect';

const el = (id) => document.getElementById(id);

// Composite formulas from the original cohorts module.
const compositeFormulas = {
  momentum: (s) => (s.efficiency + s.engagement + s.wayfinding) / 3,
  skill: (s) => (s.proficiency + s.ict + s.domain) / 3,
  ct: (s) => (s.trust_align + s.trust + (100 - s.frustration)) / 3,
  ra: (s) => (s.stability + s.adaptability + (100 - s.cogload)) / 3,
  gi: (s) => (s.collaboration + s.sustainability + s.ethics) / 3
};

function classifyCohort(s) {
  const mom = (s.efficiency + s.engagement + s.wayfinding) / 3;
  const cautious = (v) => v >= 46 && v <= 56;
  if (mom <= 35) return 'Frustrated Explorer';
  if (s.engagement >= 50 && mom <= 58 && (cautious(s.trust) || cautious(s.trust_align))) return 'Careful Checker';
  if ((s.trust <= 42 || s.trust_align <= 42) && s.engagement >= 50) return 'Distrustful Checker';
  if (mom <= 45 && (s.wayfinding < 45 || s.efficiency < 45) && s.frustration >= 55) return 'Frustrated Explorer';
  if ((mom >= 68 && s.proficiency >= 62 && (s.trust >= 56 || s.trust_align >= 56) && s.frustration <= 48)
    || (mom >= 72 && s.proficiency >= 58 && s.frustration <= 45)) return 'Confident Navigator';
  if ((s.adaptability >= 58 || s.stability >= 58) && mom >= 50 && s.frustration <= 60) return 'Resilient Improviser';
  return 'Unclassified';
}

// ---- Engine ----

let engine = createScoreEngine({ dimensions, params });
const history = [];

// ---- Collector emission for contract-shaped signals ----

const networkTransport = createBrowserTransport(window);
const tag = installFluxBrowserTag(window, {
  endpoint,
  transport: async ({ endpoint: target, body }) => {
    try { await networkTransport({ endpoint: target, body }); } catch { /* local demo */ }
  }
});

const contractEmit = {
  'act.rage': (ev) => window.flux('event', 'input', 'control.rage-click', { role: 'control', element_key: 'playground', reason: ev.reason ?? 'unknown' }),
  'assist.help': () => window.flux('event', 'assist', 'help.opened', { role: 'control', element_key: 'playground-help', reason: 'help_requested' }),
  'flow.submit': () => window.flux('event', 'nav', 'form.submitted', { role: 'form', element_key: 'playground-form', navigation_direction: 'forward' }),
  'error.invalid': () => window.flux('event', 'input', 'validation.error', { role: 'form', element_key: 'playground-form', reason: 'validation_error' }),
  'edit.paste': () => window.flux('event', 'clipboard', 'field.paste', { role: 'field', element_key: 'playground' })
};

// ---- Behaviour capture and signal routing ----

const COUNT_LABELS = {
  keypresses: 'Key presses', corrections: 'Corrections (backspace/delete)', pastes: 'Pastes',
  autocompletes: 'Autocomplete fills', shortcuts: 'Keyboard shortcuts', fieldFocuses: 'Field focuses',
  revisits: 'Field revisits', tabMoves: 'Tab moves between fields', clickMoves: 'Click moves between fields',
  forwardStreaks: 'Forward streaks (3+)', backSkips: 'Back or skip moves', rageClicks: 'Rage clicks',
  dwellLong: 'Long dwells (4s+)', idleEpisodes: 'Idle episodes (6s+)', ndGreen: 'Pointer acquisitions — green',
  ndAmber: 'Pointer acquisitions — amber', ndRed: 'Pointer acquisitions — red', misses: 'Missed clicks near targets',
  helpViews: 'Help views', lookups: 'Address lookups', validationErrors: 'Validation errors',
  errorRecoveries: 'Error recoveries', submits: 'Successful submits', assuranceTicks: 'Assurance confirmations',
  passwordToggles: 'Password show/hide', handoffs: 'Handoffs', contextNotes: 'Context notes',
  oversightAcks: 'Oversight acknowledgements', policyBreaches: 'Policy breaches (simulated)',
  fatigueMarks: 'Long-session marks', personaPlays: 'Persona replays'
};

let countsDirty = true;
let lastWpm = null;

function handleSignal(ev) {
  applyAutoNudges(engine, ev);
  countsDirty = true;

  const label = el('playground-last-signal');
  if (label) label.textContent = `${ev.type}.${ev.metric}`;

  if (ev.type === 'edit' && ev.metric === 'typing') lastWpm = Math.round(ev.value / 5);
  if (ev.type === 'pointer' && ev.metric === 'ndAttempt') {
    updateNdPanel(ev);
    pointerViz.addAttempt(ev);
  }

  const emitter = contractEmit[`${ev.type}.${ev.metric}`];
  if (emitter && tag.hasConsent) emitter(ev);
}

const pointerViz = initPointerViz(document, window, {
  pathCanvasId: 'pointer-path-canvas',
  scatterCanvasId: 'acquisition-matrix-canvas',
  ndBand
});

const behaviour = instrumentBehaviour(document, window, { onSignal: handleSignal, ndBand });
const counts = behaviour.counts;

// Console access for exploration and debugging; mirrors the original
// playground's window.flux.scores getter.
window.fluxPlayground = {
  scores: () => engine.snapshot(),
  counts,
  signal: handleSignal
};

function updateNdPanel(nd) {
  el('nd-pointer').textContent = nd.pointerType;
  el('nd-eff').textContent = nd.path_efficiency.toFixed(2);
  el('nd-subs').textContent = String(nd.submovements);
  el('nd-time').textContent = `${nd.time_to_acquire_ms} ms`;
  el('nd-misses').textContent = String(nd.misses_per_target);
  el('nd-band').textContent = nd.aimed ? nd.band : `${nd.band} (unaimed click)`;
}

function renderCounts() {
  const body = el('playground-counts');
  if (!body) return;
  body.replaceChildren();
  for (const [key, label] of Object.entries(COUNT_LABELS)) {
    if (!counts[key]) continue;
    const row = document.createElement('tr');
    row.className = 'govuk-table__row';
    const th = document.createElement('th');
    th.className = 'govuk-table__header';
    th.scope = 'row';
    th.textContent = label;
    const td = document.createElement('td');
    td.className = 'govuk-table__cell govuk-table__cell--numeric';
    td.textContent = String(counts[key]);
    row.append(th, td);
    body.appendChild(row);
  }
  if (!body.children.length) {
    const row = document.createElement('tr');
    row.className = 'govuk-table__row';
    const td = document.createElement('td');
    td.className = 'govuk-table__cell';
    td.textContent = 'No behaviours recorded yet — start interacting with the form.';
    row.appendChild(td);
    body.appendChild(row);
  }
  if (lastWpm !== null) el('nd-wpm').textContent = `${lastWpm} wpm`;
}

// ---- Form behaviours ----

el('playground-help')?.addEventListener('toggle', (e) => {
  if (!e.target.open) return;
  counts.helpViews += 1;
  handleSignal({ type: 'assist', metric: 'help' });
});

document.querySelectorAll('.playground-assurance').forEach((box) => {
  box.addEventListener('change', () => {
    if (!box.checked) return;
    counts.assuranceTicks += 1;
    handleSignal({ type: 'trust', metric: 'assuranceTick' });
  });
});

// Password show/hide (trust events, as in the original fixtures).
el('password-toggle')?.addEventListener('click', (e) => {
  const field = el('case-password');
  const showing = field.type === 'text';
  field.type = showing ? 'password' : 'text';
  e.target.textContent = showing ? 'Show' : 'Hide';
  e.target.setAttribute('aria-pressed', String(!showing));
  counts.passwordToggles += 1;
  handleSignal({ type: 'trust', metric: showing ? 'passwordHide' : 'passwordReveal' });
});

// Deterministic address lookup from the original playground.
el('find-address')?.addEventListener('click', () => {
  const list = el('address-results');
  const pc = (el('postcode').value || 'SW1A 1AA').trim().toUpperCase();
  const key = pc.replace(/\s+/g, '') || 'SW1A1AA';
  const seed = [...key].reduce((a, c) => ((a * 31 + c.charCodeAt(0)) >>> 0), 7);
  const rnd = (i) => ((seed * (1103515245 + i * 97) + 12345) >>> 0) % 100;
  const streets = ['High Street', 'Station Road', 'Main Street', 'Park Avenue', 'Church Lane'];
  const towns = ['London', 'Bristol', 'Leeds', 'Manchester', 'Cardiff'];

  counts.lookups += 1;
  handleSignal({ type: 'lookup', metric: 'start' });

  list.replaceChildren();
  for (let i = 0; i < 4; i += 1) {
    const line1 = `${1 + (rnd(i) % 220)} ${streets[rnd(i + 1) % streets.length]}`;
    const town = towns[rnd(i + 2) % towns.length];
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'govuk-link playground-address-option';
    button.textContent = `${line1}, ${town}, ${pc}`;
    button.addEventListener('click', () => {
      el('address-line1').value = line1;
      el('address-town').value = town;
      el('postcode').value = pc;
      list.setAttribute('hidden', '');
      handleSignal({ type: 'lookup', metric: 'select' });
    });
    item.appendChild(button);
    list.appendChild(item);
  }
  list.removeAttribute('hidden');
});

// Submit with validation, error summary and recovery tracking.
const requiredFields = [
  { id: 'officer-id', group: 'group-officer-id', error: 'officer-id-error', message: 'Enter your officer ID' },
  { id: 'rationale', group: 'group-rationale', error: 'rationale-error', message: 'Enter the rationale for this request' }
];
const previouslyInvalid = new Set();

el('playground-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const summary = el('playground-error-summary');
  const listEl = el('playground-error-list');
  listEl.replaceChildren();
  let bad = 0;

  for (const field of requiredFields) {
    const empty = !(el(field.id).value || '').trim();
    el(field.group).classList.toggle('govuk-form-group--error', empty);
    el(field.error).toggleAttribute('hidden', !empty);
    if (empty) {
      bad += 1;
      counts.validationErrors += 1;
      previouslyInvalid.add(field.id);
      handleSignal({ type: 'error', metric: 'invalid' });
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${field.id}`;
      link.textContent = field.message;
      item.appendChild(link);
      listEl.appendChild(item);
    } else if (previouslyInvalid.has(field.id)) {
      previouslyInvalid.delete(field.id);
      counts.errorRecoveries += 1;
      handleSignal({ type: 'error', metric: 'recovered' });
    }
  }

  summary.toggleAttribute('hidden', bad === 0);
  el('playground-confirmation').toggleAttribute('hidden', bad !== 0);
  if (bad > 0) summary.focus();
  else {
    counts.submits += 1;
    handleSignal({ type: 'flow', metric: 'submit' });
  }
});

// Team and governance actions.
const teamActions = [
  ['btn-handoff', 'handoffs', { type: 'handoff', metric: 'note' }],
  ['btn-context-note', 'contextNotes', { type: 'context', metric: 'note' }],
  ['btn-oversight', 'oversightAcks', { type: 'oversight', metric: 'ack' }],
  ['btn-breach', 'policyBreaches', { type: 'policy', metric: 'breach' }],
  ['btn-fatigue', 'fatigueMarks', { type: 'fatigue', metric: 'mark' }]
];
for (const [id, countKey, signalDef] of teamActions) {
  el(id)?.addEventListener('click', () => {
    counts[countKey] += 1;
    handleSignal(signalDef);
  });
}

// Persona replay: reset to neutral, then apply the recorded deltas.
el('persona-play')?.addEventListener('click', () => {
  const name = el('persona-select').value;
  if (!name || !personas[name]) return;
  // Backdate the seed so the replay deltas clear the per-second rate limit.
  engine = createScoreEngine({ dimensions, params, now: Date.now() - 3000 });
  history.length = 0;
  counts.personaPlays += 1;
  engine.nudge(personas[name]);
  countsDirty = true;
  el('playground-last-signal').textContent = `persona.play (${name})`;
});

el('playground-reset')?.addEventListener('click', () => {
  engine = createScoreEngine({ dimensions, params });
  history.length = 0;
  countsDirty = true;
});

// ---- Engine tuning controls ----

const tuningSpecs = [
  ['decay_per_second_toward_neutral', 'Decay per second', 0, 1, 0.01],
  ['delta_ema_alpha', 'EMA alpha', 0.05, 1, 0.05],
  ['max_change_per_second', 'Max change per second', 1, 20, 0.5],
  ['deadband_abs', 'Deadband', 0, 2, 0.05],
  ['backskip_min_gap_ms', 'Back/skip min gap (ms)', 0, 2000, 50]
];

(function renderTuning() {
  const host = el('playground-tuning');
  if (!host) return;
  for (const [key, label, min, max, step] of tuningSpecs) {
    const group = document.createElement('div');
    group.className = 'govuk-form-group playground-tuning-row';
    const labelEl = document.createElement('label');
    labelEl.className = 'govuk-label govuk-label--s';
    labelEl.htmlFor = `tune-${key}`;
    const valueEl = document.createElement('span');
    valueEl.className = 'playground-tuning-value';
    valueEl.textContent = String(params[key]);
    labelEl.textContent = `${label}: `;
    labelEl.appendChild(valueEl);
    const input = document.createElement('input');
    input.type = 'range';
    input.id = `tune-${key}`;
    input.className = 'playground-tuning-range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(params[key]);
    input.addEventListener('input', () => {
      const value = Number(input.value);
      engine.setParam(key, value);
      valueEl.textContent = String(value);
    });
    group.append(labelEl, input);
    host.appendChild(group);
  }
})();

// ---- Charts and render loop ----

const coreLineKeys = ['efficiency', 'engagement', 'proficiency', 'wayfinding', 'frustration', 'cogload'];
const lineDimensions = dimensions.filter((d) => coreLineKeys.includes(d.key));

const bars = createScoreBars({ containerId: 'playground-score-bars', dimensions, bands, neutral: params.neutral });
const lines = createScoreLines({ containerId: 'playground-score-lines', dimensions: lineDimensions, neutral: params.neutral });
const compositeBars = createScoreBars({
  containerId: 'playground-composite-bars',
  dimensions: compositeDefs,
  bands,
  neutral: params.neutral
});

let running = false;

el('playground-consent')?.addEventListener('click', (e) => {
  window.flux('consent', 'granted');
  window.flux('event', 'trust', 'consent.granted', { role: 'service', element_key: 'playground-consent' });
  el('playground-zone').removeAttribute('hidden');
  // [hidden] loses to .govuk-button's display rule, so hide explicitly.
  e.target.style.display = 'none';
  const note = el('playground-session-note');
  if (note) note.textContent = `Consented session ${tag.sessionId}. Contract events post to ${endpoint}; scores are computed locally in your browser.`;

  if (running) return;
  running = true;

  setInterval(() => engine.decay(), 1000);

  setInterval(() => {
    const scores = engine.snapshot();
    history.push({ at: Date.now(), scores });
    while (history.length > 240) history.shift();

    bars.draw(scores);
    lines.draw(history, Date.now());
    const compositeScores = {};
    for (const def of compositeDefs) compositeScores[def.key] = compositeFormulas[def.key]?.(scores) ?? params.neutral;
    compositeBars.draw(compositeScores);

    el('playground-cohort').textContent = classifyCohort(scores);
    if (countsDirty) { renderCounts(); countsDirty = false; }
  }, 500);
});
