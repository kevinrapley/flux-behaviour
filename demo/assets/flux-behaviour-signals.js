// Behavioural signal capture ported from the original playground modules
// (flux-behavioural-analytics public/js/activity.js, formkit.js,
// pointerviz.js, flux_sdk_v1.5.0.js miss policy). Everything measured is
// interaction metadata: counts, timings, geometry and input methods.
// Content is never read — key identity reduces to printable/backspace/other
// and pointer capture stores coordinates, not targets' values.

const RAGE_WINDOW_MS = 700;
const CLICKS_BETWEEN_WINDOW_MS = 2000;
const IDLE_EPISODE_MS = 6000;
const CREDITABLE_WINDOW_MS = 3500;
const ACQUISITION_WINDOW_MS = 1200;
const SUBMOVEMENT_ANGLE_RAD = 0.9;

const INTERACTIVE_INCLUDE = [
  "input:not([type='hidden']):not([disabled])",
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  "[role='button']:not([aria-disabled='true'])"
];

const MISS_EXCLUDE = [
  'label',
  "a:not([role='button'])",
  'summary', 'details', 'fieldset', 'legend', 'svg', 'img',
  "[aria-hidden='true']", "[tabindex='-1']"
];

export function createBehaviourCounts() {
  return {
    keypresses: 0,
    corrections: 0,
    undos: 0,
    pastes: 0,
    autocompletes: 0,
    shortcuts: 0,
    passiveTabStreaks: 0,
    lookupRetries: 0,
    passwordToggleBursts: 0,
    rushedAssuranceTicks: 0,
    fieldFocuses: 0,
    revisits: 0,
    tabMoves: 0,
    clickMoves: 0,
    forwardStreaks: 0,
    backSkips: 0,
    rageClicks: 0,
    dwellLong: 0,
    idleEpisodes: 0,
    ndGreen: 0,
    ndAmber: 0,
    ndRed: 0,
    misses: 0,
    helpViews: 0,
    lookups: 0,
    validationErrors: 0,
    errorRecoveries: 0,
    submits: 0,
    assuranceTicks: 0,
    passwordToggles: 0,
    handoffs: 0,
    contextNotes: 0,
    oversightAcks: 0,
    policyBreaches: 0,
    fatigueMarks: 0,
    personaPlays: 0
  };
}

export function bandForNd(metrics, ndBand) {
  const { efficiency, submovements } = ndBand;
  const eff = metrics.path_efficiency;
  const subs = metrics.submovements;
  const misses = metrics.misses_per_target ?? 0;

  let band = 'RED';
  if (eff >= efficiency.green_min && subs <= submovements.green_max) band = 'GREEN';
  else if (eff >= efficiency.amber_min || subs <= submovements.amber_max) band = 'AMBER';

  // adjustBandForMisses, exactly as in the original pointer visualisation:
  // many misses force RED; a few misses deny GREEN.
  if (misses >= 10) return 'RED';
  if (misses >= 3 && band === 'GREEN') return 'AMBER';
  return band;
}

// Kinematics from the original pointerviz.js: 3-point box smoothing, a 1.2px
// jitter gate, ~22 degree submovement threshold, and — critically — a click
// with no real approach movement scores efficiency 0, not 1. There was no
// aiming task to be efficient at.
export function computeKinematics(points) {
  if (!points || points.length < 2) {
    return { path_efficiency: 0, submovements: 1, duration_ms: 0, aimed: false };
  }

  const smoothed = new Array(points.length);
  smoothed[0] = points[0];
  for (let i = 1; i < points.length - 1; i += 1) {
    smoothed[i] = {
      x: (points[i - 1].x + points[i].x + points[i + 1].x) / 3,
      y: (points[i - 1].y + points[i].y + points[i + 1].y) / 3,
      t: points[i].t
    };
  }
  smoothed[points.length - 1] = points[points.length - 1];

  const MIN_STEP = 1.2;
  const MIN_ANGLE = (22 * Math.PI) / 180;
  let pathLength = 0;
  let submovements = 1;
  let lastAngle = null;

  for (let i = 1; i < smoothed.length; i += 1) {
    const dx = smoothed[i].x - smoothed[i - 1].x;
    const dy = smoothed[i].y - smoothed[i - 1].y;
    const segment = Math.hypot(dx, dy);
    pathLength += segment;
    if (segment < MIN_STEP) continue;

    const angle = Math.atan2(dy, dx);
    if (lastAngle !== null) {
      let diff = Math.abs(angle - lastAngle);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff > MIN_ANGLE) {
        submovements += 1;
        lastAngle = angle;
      }
    } else {
      lastAngle = angle;
    }
  }

  const direct = Math.hypot(
    smoothed[smoothed.length - 1].x - smoothed[0].x,
    smoothed[smoothed.length - 1].y - smoothed[0].y
  );
  const duration_ms = Math.round(smoothed[smoothed.length - 1].t - smoothed[0].t);

  // An "aimed" acquisition needs a real approach: meaningful travel over
  // meaningful time. Stationary or twitch clicks are not aiming tasks and
  // must never earn efficiency credit (this is what made rage clicks look
  // efficient before).
  const aimed = direct >= 30 && duration_ms >= 100;
  const path_efficiency = aimed
    ? Math.max(0, Math.min(1, direct / Math.max(pathLength, 1e-6)))
    : 0;

  return { path_efficiency, submovements: Math.min(submovements, 60), duration_ms, aimed };
}

// Typing-speed maths shared with the journey capture.
export function computeCharsPerMinute(printableCount, typingMs) {
  if (printableCount < 2 || typingMs <= 0) return 0;
  return Math.min(Math.round(printableCount / (typingMs / 60000)), 2000);
}

// Creditable-input appropriateness (formkit.js isAppropriate, widened so
// realistic GOV.UK components can earn credit): short numeric parts like a
// date input's day field are creditable from one digit; free text needs two
// meaningful characters.
export function isCreditableValue({ value, inputMode }) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!/[A-Za-z0-9]/.test(trimmed)) return false;
  const minLength = inputMode === 'numeric' ? 1 : 2;
  return trimmed.length >= minLength;
}

// Dwell is engaged production, not struggle, when the person was actively
// typing for the time they spent: at least ~0.5 printable characters per
// second of dwell (minimum 2).
export function isActiveDwell(printableCount, dwellSeconds) {
  return printableCount >= Math.max(2, dwellSeconds * 0.5);
}

export function instrumentBehaviour(doc, win, { onSignal, ndBand }) {
  const counts = createBehaviourCounts();
  const signal = (s) => {
    try { onSignal(s); } catch { /* observers must not break capture */ }
  };

  const isField = (el) => !!(el && el.matches && el.matches('input, textarea, select'));
  const isText = (el) => !!(el && el.matches && el.matches("textarea, input:not([type='radio']):not([type='checkbox']):not([type='hidden'])"));
  const matchesAny = (el, selectors) => selectors.some((sel) => {
    try { return el.matches(sel) || !!el.closest(sel); } catch { return false; }
  });

  // ---- Creditable input tracking (formkit.js) ----
  const fieldMeta = new WeakMap();
  const meta = (el) => {
    let m = fieldMeta.get(el);
    if (!m) {
      m = { creditableSince: 0, focusCount: 0, focusedAt: 0, keyPresses: 0, backspaces: 0, printable: 0, typingMs: 0, lastKeyAt: null };
      fieldMeta.set(el, m);
    }
    return m;
  };
  const isCreditable = (el) => {
    if (!el) return false;
    const m = fieldMeta.get(el);
    return !!m && m.creditableSince > 0 && performance.now() - m.creditableSince <= CREDITABLE_WINDOW_MS;
  };

  doc.addEventListener('input', (e) => {
    const el = e.target;
    if (!isText(el)) return;
    const appropriate = isCreditableValue({ value: el.value, inputMode: el.getAttribute?.('inputmode') });
    if (appropriate && (!el.checkValidity || el.checkValidity())) {
      meta(el).creditableSince = performance.now();
    }
    if (e.inputType === 'insertReplacementText') {
      counts.autocompletes += 1;
      signal({ type: 'act', metric: 'autocomplete' });
    }
  }, true);

  // Choosing a radio, checkbox or select option is creditable input too —
  // otherwise completing a choice question and moving on is punished as
  // empty-field navigation.
  doc.addEventListener('change', (e) => {
    const el = e.target;
    if (!el || !el.matches) return;
    if (el.matches("input[type='radio'], input[type='checkbox']") || (el.matches('select') && el.value)) {
      meta(el).creditableSince = performance.now();
    }
  }, true);

  // ---- Focus navigation: tabs, clicksBetween, streaks, revisits, dwell ----
  let navMethod = 'click';
  let lastFocused = null;
  let lastBlurAt = 0;
  let lastIndex = null;
  let tabForward = 0;
  let clickForward = 0;
  let passiveTabs = 0;

  win.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') navMethod = e.shiftKey ? 'tab-prev' : 'tab-next';
    if ((e.metaKey || e.ctrlKey) && e.key.length === 1) {
      const key = e.key.toLowerCase();
      if (key === 'z') {
        // Undo is a correction signal, not tool fluency — the v6.10
        // frustration formula counts undo bursts.
        counts.undos += 1;
        signal({ type: 'edit', metric: 'undo' });
      } else if (key !== 'v') {
        // Cmd/Ctrl+V is owned by the paste signal; counting it here too
        // would double-score one behaviour.
        counts.shortcuts += 1;
        signal({ type: 'act', metric: 'shortcut' });
      }
    }
  }, true);
  ['pointerdown', 'touchstart'].forEach((t) => win.addEventListener(t, () => { navMethod = 'click'; }, true));

  const fieldIndex = (el) => {
    const fields = Array.from(doc.querySelectorAll('input, textarea, select'));
    return fields.indexOf(el);
  };

  doc.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!isField(el)) return;

    const m = meta(el);
    m.focusCount += 1;
    m.focusedAt = performance.now();
    counts.fieldFocuses += 1;
    if (m.focusCount > 1) {
      counts.revisits += 1;
      signal({ type: 'field', metric: 'revisit', value: m.focusCount - 1 });
    }

    const idx = fieldIndex(el);
    let dir = 'start';
    if (lastIndex !== null && lastIndex !== -1 && idx !== -1 && idx !== lastIndex) {
      const diff = idx - lastIndex;
      dir = diff === 1 ? 'forward' : diff === -1 ? 'back' : 'skip';
    }
    const nav = { dir, method: navMethod };

    const creditable = isCreditable(lastFocused);

    if (navMethod === 'tab-next' || navMethod === 'tab-prev') {
      counts.tabMoves += 1;
      signal({ type: 'act', metric: 'tabs', nav, creditable });
    } else if (lastFocused && lastFocused !== el && Date.now() - lastBlurAt < CLICKS_BETWEEN_WINDOW_MS) {
      counts.clickMoves += 1;
      signal({ type: 'act', metric: 'clicksBetween', nav, creditable });
    }
    if (dir === 'back' || dir === 'skip') counts.backSkips += 1;

    // Streaks only count productive forward moves: leaving a field you
    // actually completed. Empty forward tabbing is the original's
    // wayfind.passiveTab — a hunting signal, the opposite of a streak.
    if (dir === 'forward' && creditable && navMethod === 'tab-next') {
      tabForward += 1; clickForward = 0; passiveTabs = 0;
    } else if (dir === 'forward' && creditable) {
      clickForward += 1; tabForward = 0; passiveTabs = 0;
    } else if (dir !== 'start' && !creditable && (navMethod === 'tab-next' || navMethod === 'tab-prev')) {
      passiveTabs += 1; tabForward = 0; clickForward = 0;
    } else {
      tabForward = 0; clickForward = 0; passiveTabs = 0;
    }

    if (tabForward > 0 && tabForward % 3 === 0) {
      counts.forwardStreaks += 1;
      signal({ type: 'act', metric: 'streak3', method: 'tab' });
    }
    if (clickForward > 0 && clickForward % 3 === 0) {
      counts.forwardStreaks += 1;
      signal({ type: 'act', metric: 'streak3', method: 'click' });
    }
    if (passiveTabs > 0 && passiveTabs % 3 === 0) {
      counts.passiveTabStreaks += 1;
      signal({ type: 'act', metric: 'passiveTabs', value: passiveTabs });
    }

    lastFocused = el;
    lastIndex = idx;
  }, true);

  doc.addEventListener('focusout', (e) => {
    const el = e.target;
    if (!isField(el)) return;
    lastBlurAt = Date.now();

    const m = meta(el);
    if (m.focusedAt) {
      const dwell = (performance.now() - m.focusedAt) / 1000;
      if (dwell > 0.05) {
        if (dwell >= 4) counts.dwellLong += 1;
        signal({
          type: 'time',
          metric: 'fieldDwell',
          value: Math.round(dwell * 100) / 100,
          active: isActiveDwell(m.printable, dwell)
        });
      }
      m.focusedAt = 0;
    }

    if (m.keyPresses >= 5 && m.backspaces / m.keyPresses > 0.25) {
      signal({ type: 'edit', metric: 'corrections', value: m.backspaces });
    }
    const cpm = computeCharsPerMinute(m.printable, m.typingMs);
    if (cpm > 0) signal({ type: 'edit', metric: 'typing', value: cpm });
    m.keyPresses = 0; m.backspaces = 0; m.printable = 0; m.typingMs = 0; m.lastKeyAt = null;
  }, true);

  // ---- Typing volume and corrections ----
  doc.addEventListener('keydown', (e) => {
    const el = e.target;
    if (!isText(el)) return;
    const m = meta(el);
    const now = performance.now();
    m.keyPresses += 1;
    counts.keypresses += 1;
    if (e.key === 'Backspace' || e.key === 'Delete') {
      m.backspaces += 1;
      counts.corrections += 1;
    } else if (e.key.length === 1) {
      m.printable += 1;
      if (m.lastKeyAt !== null) {
        const gap = now - m.lastKeyAt;
        if (gap > 0 && gap < 2000) m.typingMs += gap;
      }
    }
    m.lastKeyAt = now;
  }, true);

  doc.addEventListener('paste', (e) => {
    if (!isText(e.target)) return;
    counts.pastes += 1;
    signal({ type: 'edit', metric: 'paste' });
  }, true);

  // ---- Rage clicks (activity.js) ----
  const rageClicks = [];
  doc.addEventListener('click', (e) => {
    const el = e.target;
    if (!el || (e.button !== undefined && e.button !== 0)) return;
    const t = performance.now();
    const key = el.id || el.name || el.tagName || 'el';
    rageClicks.push({ t, key });
    for (let i = rageClicks.length - 1; i >= 0; i -= 1) {
      if (t - rageClicks[i].t > RAGE_WINDOW_MS) rageClicks.splice(i, 1);
    }
    if (rageClicks.filter((c) => c.key === key).length >= 3) {
      counts.rageClicks += 1;
      const reason = isText(el)
        ? ((el.value || '').length === 0 ? 'empty_field' : 'control_nonresponsive')
        : 'control_nonresponsive';
      signal({ type: 'act', metric: 'rage', reason });
      for (let i = rageClicks.length - 1; i >= 0; i -= 1) {
        if (rageClicks[i].key === key) rageClicks.splice(i, 1);
      }
    }
  }, true);

  // ---- Idle episodes (activity.js, 6s of no interaction) ----
  let lastActivity = Date.now();
  let idleActive = false;
  ['click', 'keydown', 'input', 'pointermove', 'scroll', 'focusin', 'pointerdown', 'touchstart']
    .forEach((t) => win.addEventListener(t, () => {
      if (idleActive) {
        idleActive = false;
        counts.idleEpisodes += 1;
        signal({ type: 'time', metric: 'idleEpisode', value: Math.round((Date.now() - lastActivity) / 1000) });
      }
      lastActivity = Date.now();
    }, { passive: true, capture: true }));
  const idleTimer = setInterval(() => {
    if (!idleActive && Date.now() - lastActivity >= IDLE_EPISODE_MS) idleActive = true;
  }, 1000);

  // ---- Pointer kinematics and miss policy (pointerviz.js, sdk v1.5.0) ----
  // Bursts, as in the original: an acquisition attempt starts at pointerdown,
  // seeded with the last 800ms of approach hover, and closes at pointerup on
  // an interactive target. Kinematics are computed on the burst, never on a
  // rolling window, so repeated stationary clicks measure as unaimed.
  const HOVER_WINDOW_MS = 800;
  const hoverTrail = [];
  let burst = null;
  const missQueue = [];
  let latestNd = null;

  doc.addEventListener('pointermove', (e) => {
    const t = performance.now();
    hoverTrail.push({ x: e.clientX, y: e.clientY, t });
    while (hoverTrail.length > 0 && t - hoverTrail[0].t > HOVER_WINDOW_MS) hoverTrail.shift();
    if (burst) burst.push({ x: e.clientX, y: e.clientY, t });
  }, { passive: true, capture: true });

  doc.addEventListener('pointerdown', (e) => {
    if (!(e.target instanceof win.Element)) return;
    const t = performance.now();
    burst = hoverTrail.filter((p) => t - p.t <= HOVER_WINDOW_MS).map((p) => ({ ...p }));
    burst.push({ x: e.clientX, y: e.clientY, t });
    missQueue.push({ el: e.target, x: e.clientX, y: e.clientY, t });
    while (missQueue.length > 0 && t - missQueue[0].t > ACQUISITION_WINDOW_MS) missQueue.shift();
  }, true);

  doc.addEventListener('pointerup', (e) => {
    const clicked = e.target;
    const points = burst;
    burst = null;
    if (!(clicked instanceof win.Element) || !points) return;

    let target = null;
    for (const sel of INTERACTIVE_INCLUDE) {
      try { target = clicked.closest(sel); } catch { target = null; }
      if (target) break;
    }
    if (!target) return;

    const rect = target.getBoundingClientRect();
    let misses = 0;
    const cutoff = performance.now() - ACQUISITION_WINDOW_MS;
    for (const m of missQueue) {
      if (m.t < cutoff) continue;
      if (matchesAny(m.el, MISS_EXCLUDE)) continue;
      if (m.x >= rect.left && m.x <= rect.right && m.y >= rect.top && m.y <= rect.bottom) continue;
      misses += 1;
    }
    counts.misses += misses;

    points.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    // An acquisition consumes its approach. Without this, rapid re-clicks
    // inherit the previous approach from the hover window and each rage
    // click re-scores as a fresh aimed, efficient acquisition.
    hoverTrail.length = 0;
    const kinematics = computeKinematics(points);
    const metrics = {
      pointerType: e.pointerType || 'mouse',
      path_efficiency: Math.round(kinematics.path_efficiency * 100) / 100,
      submovements: kinematics.submovements,
      time_to_acquire_ms: kinematics.duration_ms,
      misses_per_target: misses,
      aimed: kinematics.aimed
    };
    metrics.band = bandForNd(metrics, ndBand);
    latestNd = metrics;

    if (metrics.band === 'GREEN') counts.ndGreen += 1;
    else if (metrics.band === 'AMBER') counts.ndAmber += 1;
    else counts.ndRed += 1;

    signal({ type: 'pointer', metric: 'ndAttempt', ...metrics });
  }, true);

  return {
    counts,
    isCreditable,
    latestNd: () => latestNd,
    destroy() { clearInterval(idleTimer); }
  };
}
