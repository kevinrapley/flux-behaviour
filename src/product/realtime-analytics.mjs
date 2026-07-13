const MINUTE_MS = 60000;
const LIVE_MS = 2 * MINUTE_MS;
const DELAYED_MS = 10 * MINUTE_MS;

export function buildRealtimeSnapshot(rows = {}, now = Date.now()) {
  const latestAcceptedAtMs = timestamp(rows.events?.latest_accepted_at_ms);
  const freshnessMs = latestAcceptedAtMs === null ? null : Math.max(0, now - latestAcceptedAtMs);
  const currentMinute = Math.floor(now / MINUTE_MS) * MINUTE_MS;
  const observed = new Map((rows.minutes ?? []).map((row) => [timestamp(row.minute_start_ms), count(row.interaction_count)]));
  const interactionsPerMinute = Array.from({ length: 30 }, (_, index) => {
    const minuteStartMs = currentMinute - ((29 - index) * MINUTE_MS);
    return { minute_start_ms: minuteStartMs, interaction_count: observed.get(minuteStartMs) ?? 0 };
  });
  return {
    generated_at_ms: now,
    active_sessions_5m: count(rows.sessions?.active_sessions_5m),
    active_sessions_30m: count(rows.sessions?.active_sessions_30m),
    interactions_5m: count(rows.events?.interactions_5m),
    interactions_30m: count(rows.events?.interactions_30m),
    latest_accepted_at_ms: latestAcceptedAtMs,
    freshness_ms: freshnessMs,
    freshness_status: freshnessStatus(freshnessMs),
    interactions_per_minute: interactionsPerMinute
  };
}

function freshnessStatus(value) {
  if (value === null) return 'no_data';
  if (value <= LIVE_MS) return 'live';
  if (value <= DELAYED_MS) return 'delayed';
  return 'stale';
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function timestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}
