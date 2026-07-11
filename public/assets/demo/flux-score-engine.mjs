// Demo score engine ported from the original playground engine
// (flux-behavioural-analytics public/js/engine.js, "stable v46.s") and its
// dual-channel frustration model (public/js/frustration.js).
//
// Semantics, matching the original: every applied stimulus is its own engine
// tick — EMA smoothing, then a median filter, then a deadband, then a
// per-second rate limit against the time since that channel last moved.
// Decay toward neutral runs separately on a clock. This is event-driven, so
// a single event (like opening help) visibly moves its dimensions.
//
// Frustration is virtual: positive stimuli feed an "event" channel, soothing
// behaviours feed a "tone" channel, and the reported score is
// 0.8 * max(event, tone) + 0.2 * mean(event, tone).
//
// Demonstration logic for the playground, not promoted production scoring.

const FR_EVENT = 'fr_event';
const FR_TONE = 'fr_tone';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

class Ema {
  constructor(alpha) {
    this.alpha = alpha;
    this.value = 0;
  }
  next(x) {
    this.value = this.alpha * x + (1 - this.alpha) * this.value;
    return this.value;
  }
}

class MedianWindow {
  constructor(size) {
    this.size = size;
    this.buffer = [];
  }
  next(x) {
    this.buffer.push(x);
    if (this.buffer.length > this.size) this.buffer.shift();
    const sorted = [...this.buffer].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}

class Channel {
  constructor(params) {
    this.params = params;
    this.last = params.neutral;
    this.lastT = 0;
    this.ema = new Ema(params.delta_ema_alpha);
    this.median = new MedianWindow(params.median_window_k);
  }

  tick(t, raw) {
    const dt = Math.max(1, t - (this.lastT || t));
    this.lastT = t;

    let delta = this.median.next(this.ema.next(raw));
    if (Math.abs(delta) < this.params.deadband_abs) delta = 0;

    const maxStep = (this.params.max_change_per_second * dt) / 1000;
    const step = clamp(delta, -maxStep, maxStep);
    this.last = clamp(this.last + step, this.params.bounds[0], this.params.bounds[1]);
    return this.last;
  }

  decay(t) {
    if (!this.lastT) this.lastT = t;
    const dt = Math.max(1, t - this.lastT);
    this.lastT = t;

    const sign = this.last > this.params.neutral ? -1 : 1;
    const step = sign * ((this.params.decay_per_second_toward_neutral * dt) / 1000);
    const diff = Math.abs(this.last - this.params.neutral);

    this.last = diff <= Math.abs(step)
      ? this.params.neutral
      : clamp(this.last + step, this.params.bounds[0], this.params.bounds[1]);
    return this.last;
  }

  value() {
    return this.last;
  }
}

export function createScoreEngine({ dimensions, params: sourceParams, now = Date.now() }) {
  const params = { ...sourceParams };
  const channels = new Map();

  // Seed every channel's clock, as the original page did on load, so the
  // first event measures real elapsed time instead of a 1ms tick.
  const seedChannel = () => {
    const channel = new Channel(params);
    channel.lastT = now;
    return channel;
  };

  for (const dimension of dimensions) {
    if (dimension.key === 'frustration') continue;
    channels.set(dimension.key, seedChannel());
  }
  channels.set(FR_EVENT, seedChannel());
  channels.set(FR_TONE, seedChannel());

  const hasFrustration = dimensions.some((d) => d.key === 'frustration');
  let lastBack = -Infinity;
  let backBursts = [];

  function applyRaw(key, delta, t) {
    const channel = channels.get(key);
    if (channel && Number.isFinite(delta) && delta !== 0) channel.tick(t, delta);
  }

  function frustrationVirtual() {
    const e = channels.get(FR_EVENT).value();
    const r = channels.get(FR_TONE).value();
    return clamp(0.8 * Math.max(e, r) + 0.2 * ((e + r) / 2), params.bounds[0], params.bounds[1]);
  }

  return {
    params,

    setParam(key, value) {
      if (key in params && Number.isFinite(value)) params[key] = value;
    },

    apply(key, delta, t = Date.now()) {
      if (key === 'frustration') {
        // Positive pressure raises the event channel; soothing lowers tone.
        applyRaw(delta >= 0 ? FR_EVENT : FR_TONE, delta, t);
        return;
      }
      applyRaw(key, delta, t);
    },

    nudge(map, t = Date.now()) {
      for (const [key, delta] of Object.entries(map || {})) {
        this.apply(key, Number(delta || 0), t);
      }
    },

    // Burst-limited back/skip penalty from the original engine.
    backOrSkip(t = Date.now()) {
      if (t - lastBack <= params.backskip_min_gap_ms) return;
      backBursts = backBursts.filter((x) => t - x < 10000);
      if (backBursts.length < 4) {
        applyRaw('efficiency', -1.8, t);
        applyRaw('wayfinding', -1.1, t);
        backBursts.push(t);
        lastBack = t;
      }
    },

    decay(t = Date.now()) {
      for (const channel of channels.values()) channel.decay(t);
    },

    snapshot() {
      const scores = {};
      for (const [key, channel] of channels.entries()) {
        if (key === FR_EVENT || key === FR_TONE) continue;
        scores[key] = Math.round(channel.value() * 10) / 10;
      }
      if (hasFrustration) {
        scores.frustration = Math.round(frustrationVirtual() * 10) / 10;
      }
      return scores;
    }
  };
}
