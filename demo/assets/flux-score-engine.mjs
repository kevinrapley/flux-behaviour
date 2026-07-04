// Demo score engine implementing the engine reference parameters from
// config/scoring/flux-scoring-config.v6.10.reference.json: scores start at
// neutral, raw stimuli are median-filtered then EMA-smoothed, per-second
// change is rate-limited, and scores decay toward neutral when nothing
// happens. This is demonstration logic for the playground, not promoted
// production scoring.

export function createScoreEngine({ dimensions, params }) {
  const {
    neutral = 50,
    bounds = [0, 100],
    delta_ema_alpha: emaAlpha = 0.25,
    median_window_k: medianWindow = 5,
    max_change_per_second: maxChangePerSecond = 6,
    decay_per_second_toward_neutral: decayPerSecond = 0.12,
    deadband_abs: deadband = 0.2
  } = params;

  const state = new Map();
  for (const dimension of dimensions) {
    state.set(dimension.key, {
      score: neutral,
      pending: 0,
      recentRaw: [],
      ema: 0
    });
  }

  function median(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  return {
    stimulus(key, delta) {
      const dimension = state.get(key);
      if (!dimension || !Number.isFinite(delta)) return;
      dimension.pending += delta;
    },

    tick(dtSeconds) {
      if (!(dtSeconds > 0)) return;

      for (const dimension of state.values()) {
        dimension.recentRaw.push(dimension.pending);
        dimension.pending = 0;
        if (dimension.recentRaw.length > medianWindow) {
          dimension.recentRaw.shift();
        }

        const filtered = median(dimension.recentRaw);
        dimension.ema = emaAlpha * filtered + (1 - emaAlpha) * dimension.ema;

        let change = Math.abs(dimension.ema) < deadband ? 0 : dimension.ema;
        const maxChange = maxChangePerSecond * dtSeconds;
        change = Math.max(-maxChange, Math.min(maxChange, change));

        dimension.score += change;
        dimension.score += (neutral - dimension.score) * Math.min(decayPerSecond * dtSeconds, 1);
        dimension.score = Math.max(bounds[0], Math.min(bounds[1], dimension.score));
      }
    },

    snapshot() {
      const scores = {};
      for (const [key, dimension] of state.entries()) {
        scores[key] = Math.round(dimension.score * 10) / 10;
      }
      return scores;
    }
  };
}
