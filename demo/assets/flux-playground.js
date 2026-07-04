import { installFluxBrowserTag, createBrowserTransport } from '/assets/flux/sdk/flux-browser.mjs';
import { instrumentFields } from '/assets/demo/flux-field-capture.js';
import { createScoreEngine } from '/assets/demo/flux-score-engine.mjs';
import { createScoreBars, createScoreLines } from '/assets/demo/flux-score-charts.js';

const config = JSON.parse(document.getElementById('flux-playground-config').textContent);
const { dimensions, params, bands } = config;

const endpoint = document.querySelector('script[data-flux-endpoint]')?.dataset?.fluxEndpoint
  ?? 'http://127.0.0.1:8787/collect';

const zone = document.getElementById('playground-zone');
const sessionNote = document.getElementById('playground-session-note');

let engine = createScoreEngine({ dimensions, params });
const history = [];

const networkTransport = createBrowserTransport(window);

async function playgroundTransport({ endpoint: target, body }) {
  try {
    await networkTransport({ endpoint: target, body });
  } catch {
    // The playground works without a collector running; scores are local.
  }
}

const tag = installFluxBrowserTag(window, {
  endpoint,
  transport: playgroundTransport
});

// --- Signal mapping: demo heuristics from events to dimension stimuli ---

function mapEventToStimuli(eventClass, action, details = {}) {
  if (action === 'field.focus') {
    engine.stimulus('eng', 1.5);
    engine.stimulus('nav', details.revisit_count > 1 ? -2 : 1);
    return;
  }

  if (action === 'field.blur') {
    const cpm = details.chars_per_minute ?? 0;
    if (cpm > 150) engine.stimulus('prof', 3);
    else if (cpm > 60) engine.stimulus('prof', 1.5);

    const keyPresses = details.key_press_count ?? 0;
    const backspaces = details.backspace_count ?? 0;
    if (keyPresses > 4 && backspaces / keyPresses > 0.25) {
      engine.stimulus('prof', -2);
      engine.stimulus('frustration', 2);
    }

    if ((details.duration_ms ?? 0) > 15000) engine.stimulus('cogload', 3);
    if ((details.edit_count ?? 0) > 0 && (details.duration_ms ?? 0) < 8000) engine.stimulus('eff', 2);
    return;
  }

  if (action === 'field.paste') {
    engine.stimulus('eff', 2);
    return;
  }

  if (action === 'help.opened') {
    engine.stimulus('cogload', 3);
    engine.stimulus('frustration', 1);
    return;
  }

  if (action === 'control.rage-click') {
    engine.stimulus('frustration', 6);
    engine.stimulus('eff', -2);
    return;
  }

  if (action === 'task.completed') {
    engine.stimulus('eff', 4);
    engine.stimulus('eng', 3);
    engine.stimulus('nav', 2);
  }
}

function emit(eventClass, action, details) {
  window.flux('event', eventClass, action, details);
  mapEventToStimuli(eventClass, action, details);
}

instrumentFields(document, emit);

// Continuous typing stimuli so scores move while you type, not only on blur.
document.addEventListener('keydown', (event) => {
  if (!event.target?.dataset?.fluxField) return;
  if (event.key === 'Backspace' || event.key === 'Delete') {
    engine.stimulus('frustration', 0.6);
    engine.stimulus('prof', -0.4);
  } else if (event.key.length === 1) {
    engine.stimulus('eng', 0.5);
    engine.stimulus('prof', 0.2);
  }
});

// Rage-click detection: three or more presses inside 700ms.
const rageTimes = [];
document.getElementById('playground-rage')?.addEventListener('click', () => {
  const now = performance.now();
  rageTimes.push(now);
  while (rageTimes.length > 0 && now - rageTimes[0] > 700) rageTimes.shift();

  if (rageTimes.length >= 3) {
    emit('input', 'control.rage-click', { role: 'control', element_key: 'playground-rage' });
    rageTimes.length = 0;
  } else {
    engine.stimulus('eff', -0.5);
  }
});

document.getElementById('playground-help')?.addEventListener('toggle', (event) => {
  if (!event.target.open) return;
  emit('assist', 'help.opened', {
    role: 'control',
    element_key: 'playground-help',
    reason: 'help_requested'
  });
});

document.getElementById('playground-complete')?.addEventListener('click', () => {
  emit('nav', 'task.completed', {
    role: 'form',
    element_key: 'playground-complete',
    navigation_direction: 'forward'
  });
});

document.getElementById('playground-reset')?.addEventListener('click', () => {
  engine = createScoreEngine({ dimensions, params });
  history.length = 0;
});

// --- Consent gate and render loop ---

const bars = createScoreBars({
  containerId: 'playground-score-bars',
  dimensions,
  bands,
  neutral: params.neutral
});
const lines = createScoreLines({
  containerId: 'playground-score-lines',
  dimensions,
  neutral: params.neutral
});

let running = false;

document.getElementById('playground-consent')?.addEventListener('click', (event) => {
  window.flux('consent', 'granted');
  window.flux('event', 'trust', 'consent.granted', { role: 'service', element_key: 'playground-consent' });
  zone?.removeAttribute('hidden');
  event.target.setAttribute('hidden', '');
  if (sessionNote) {
    sessionNote.textContent = `Consented session ${tag.sessionId}. Events post to ${endpoint}; scores are computed locally in your browser.`;
  }

  if (!running) {
    running = true;
    let lastTick = performance.now();

    setInterval(() => {
      const now = performance.now();
      engine.tick((now - lastTick) / 1000);
      lastTick = now;

      const scores = engine.snapshot();
      history.push({ at: Date.now(), scores });
      while (history.length > 240) history.shift();

      bars.draw(scores);
      lines.draw(history, Date.now());
    }, 500);
  }
});
