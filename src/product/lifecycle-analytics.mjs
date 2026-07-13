const MINIMUM_GROUP_SIZE = 5;
const DAY_MS = 86400000;
const SIGNALS = Object.freeze([
  { action: 'error.invalid', label: 'Journeys with validation errors' },
  { action: 'assist.help', label: 'Journeys using contextual help' },
  { action: 'field.revisit', label: 'Journeys revisiting a field' }
]);

export async function dashboardLifecycleAnalytics(db, { tenantId, period }) {
  const earliest = period.previous_start_at_ms ?? period.start_at_ms;
  const visitsQuery = `WITH visit_history AS (
    SELECT id, visitor_id, started_at_ms,
      LAG(started_at_ms) OVER (PARTITION BY visitor_id ORDER BY started_at_ms, id) AS previous_started_at_ms,
      ROW_NUMBER() OVER (PARTITION BY visitor_id ORDER BY started_at_ms, id) AS visit_number
    FROM sessions WHERE tenant_id = ? AND started_at_ms < ?
  )
  SELECT visitor_id, started_at_ms, previous_started_at_ms, visit_number,
    CASE WHEN started_at_ms >= ? THEN 'current' ELSE 'previous' END AS period_key
  FROM visit_history WHERE started_at_ms >= ? ORDER BY started_at_ms`;
  const signalsQuery = `WITH period_sessions AS (
    SELECT id, CASE WHEN started_at_ms >= ? THEN 'current' ELSE 'previous' END AS period_key
    FROM sessions WHERE tenant_id = ? AND started_at_ms >= ? AND started_at_ms < ?
  )
  SELECT ps.period_key, e.action, COUNT(DISTINCT ps.id) AS affected_session_count
  FROM period_sessions ps INNER JOIN events e ON e.session_id = ps.id
  WHERE e.tenant_id = ? AND e.action IN ('error.invalid', 'assist.help', 'field.revisit')
  GROUP BY ps.period_key, e.action`;
  const [visits, signals] = await Promise.all([
    db.prepare(visitsQuery).bind(tenantId, period.end_at_ms, period.start_at_ms, earliest).all(),
    db.prepare(signalsQuery).bind(period.start_at_ms, tenantId, earliest, period.end_at_ms, tenantId).all()
  ]);
  return buildLifecycleReport(visits.results ?? [], signals.results ?? [], period);
}

export function buildLifecycleReport(visitRows = [], signalRows = [], period = {}) {
  const current = visitRows.filter((row) => row.period_key === 'current');
  const previous = visitRows.filter((row) => row.period_key === 'previous');
  const repeatIntervals = current
    .filter((row) => finite(row.previous_started_at_ms) && finite(row.started_at_ms) && Number(row.started_at_ms) > Number(row.previous_started_at_ms))
    .map((row) => Number(row.started_at_ms) - Number(row.previous_started_at_ms));
  const enoughIntervals = repeatIntervals.length >= MINIMUM_GROUP_SIZE;
  return {
    privacy_note: `Recency and named lifecycle groups require at least ${MINIMUM_GROUP_SIZE} journeys. Visitor identifiers are used only inside the aggregate query and are never returned.`,
    interpretation_note: 'Changes describe consented service journeys, not learning or ability. A lower friction rate may also reflect audience, task, collection or service changes.',
    comparison_available: period.previous_start_at_ms !== null && period.previous_start_at_ms !== undefined,
    recency: {
      available: enoughIntervals,
      returning_journey_count: repeatIntervals.length,
      suppressed_journey_count: enoughIntervals ? 0 : repeatIntervals.length,
      median_interval_ms: enoughIntervals ? percentile(repeatIntervals, 0.5) : null,
      p90_interval_ms: enoughIntervals ? percentile(repeatIntervals, 0.9) : null,
      distribution: enoughIntervals ? intervalDistribution(repeatIntervals) : null
    },
    frequency: frequencySummary(current),
    maturity_movement: maturityMovement(current, previous),
    celeration: SIGNALS.map((signal) => signalMovement(signal, signalRows, current.length, previous.length, period))
  };
}

function frequencySummary(rows) {
  const visits = new Map();
  for (const row of rows) visits.set(row.visitor_id, (visits.get(row.visitor_id) ?? 0) + 1);
  const counts = [...visits.values()];
  if (counts.length < MINIMUM_GROUP_SIZE) return { available: false, visitor_count: counts.length, average_journeys: null, repeat_visitor_count: null };
  return {
    available: true,
    visitor_count: counts.length,
    average_journeys: round(counts.reduce((sum, count) => sum + count, 0) / counts.length),
    repeat_visitor_count: counts.filter((count) => count > 1).length
  };
}

function maturityMovement(current, previous) {
  const definitions = [
    { key: 'first_time', label: 'First-time journeys', matches: (visit) => visit === 1 },
    { key: 'returning', label: 'Returning journeys', matches: (visit) => visit === 2 || visit === 3 },
    { key: 'established', label: 'Established journeys', matches: (visit) => visit >= 4 }
  ];
  let suppressedJourneyCount = 0;
  const rows = [];
  for (const definition of definitions) {
    const currentCount = current.filter((row) => definition.matches(Number(row.visit_number))).length;
    const previousCount = previous.filter((row) => definition.matches(Number(row.visit_number))).length;
    if (currentCount < MINIMUM_GROUP_SIZE) {
      suppressedJourneyCount += currentCount;
      continue;
    }
    const share = rate(currentCount, current.length);
    const previousShare = previous.length >= MINIMUM_GROUP_SIZE && previousCount >= MINIMUM_GROUP_SIZE ? rate(previousCount, previous.length) : null;
    rows.push({
      key: definition.key,
      label: definition.label,
      session_count: currentCount,
      share,
      previous_share: previousShare,
      change_percentage_points: previousShare === null ? null : round(share - previousShare)
    });
  }
  return { minimum_group_size: MINIMUM_GROUP_SIZE, selected_session_count: current.length, previous_session_count: previous.length, suppressed_session_count: suppressedJourneyCount, rows };
}

function signalMovement(signal, rows, currentDenominator, previousDenominator, period) {
  const currentCount = signalCount(rows, 'current', signal.action);
  const previousCount = signalCount(rows, 'previous', signal.action);
  const currentRate = currentDenominator >= MINIMUM_GROUP_SIZE ? rate(currentCount, currentDenominator) : null;
  const previousRate = period.previous_start_at_ms !== null && period.previous_start_at_ms !== undefined && previousDenominator >= MINIMUM_GROUP_SIZE
    ? rate(previousCount, previousDenominator) : null;
  const change = currentRate === null || previousRate === null ? null : round(currentRate - previousRate);
  return {
    action: signal.action,
    label: signal.label,
    affected_session_count: currentRate === null ? null : currentCount,
    session_count: currentDenominator,
    rate: currentRate,
    previous_rate: previousRate,
    change_percentage_points: change,
    direction: change === null ? 'unavailable' : change > 1 ? 'increased' : change < -1 ? 'decreased' : 'little_change'
  };
}

function signalCount(rows, periodKey, action) {
  const row = rows.find((item) => item.period_key === periodKey && item.action === action);
  return Math.max(0, Math.floor(Number(row?.affected_session_count) || 0));
}

function intervalDistribution(intervals) {
  const result = { under_1_day: 0, from_1_to_7_days: 0, from_8_to_30_days: 0, from_31_to_90_days: 0, over_90_days: 0 };
  for (const interval of intervals) {
    if (interval < DAY_MS) result.under_1_day += 1;
    else if (interval <= 7 * DAY_MS) result.from_1_to_7_days += 1;
    else if (interval <= 30 * DAY_MS) result.from_8_to_30_days += 1;
    else if (interval <= 90 * DAY_MS) result.from_31_to_90_days += 1;
    else result.over_90_days += 1;
  }
  let suppressedIntervalCount = 0;
  for (const key of Object.keys(result)) {
    if (result[key] > 0 && result[key] < MINIMUM_GROUP_SIZE) {
      suppressedIntervalCount += result[key];
      result[key] = null;
    }
  }
  return { ...result, suppressed_interval_count: suppressedIntervalCount };
}

function percentile(values, proportion) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return Math.round(sorted[Math.ceil(proportion * sorted.length) - 1]);
}

function rate(numerator, denominator) {
  return denominator > 0 ? round((numerator / denominator) * 100) : null;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function finite(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}
