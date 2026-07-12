function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

const DAY_MS = 86400000;
const DASHBOARD_RANGES = Object.freeze({
  '7d': { days: 7, label: 'Last 7 days' },
  '30d': { days: 30, label: 'Last 30 days' },
  '90d': { days: 90, label: 'Last 90 days' },
  all: { days: null, label: 'All time' }
});

export function dashboardRange(value, now = Date.now()) {
  const key = Object.hasOwn(DASHBOARD_RANGES, value) ? value : '30d';
  const selected = DASHBOARD_RANGES[key];
  const endAtMs = now + 1;
  const startAtMs = selected.days === null ? 0 : now - (selected.days * DAY_MS);
  const previousStartAtMs = selected.days === null ? null : startAtMs - (selected.days * DAY_MS);
  return {
    key,
    label: selected.label,
    start_at_ms: startAtMs,
    end_at_ms: endAtMs,
    previous_start_at_ms: previousStartAtMs,
    previous_end_at_ms: selected.days === null ? null : startAtMs
  };
}

export function buildOverviewMetrics(sessionRow = {}, eventRow = {}) {
  const visitors = number(sessionRow.visitor_count);
  const sessions = number(sessionRow.session_count);
  const events = number(eventRow.event_count);
  const typed = number(eventRow.typed_character_count);
  const corrections = number(eventRow.correction_count);
  const returningVisitors = number(sessionRow.returning_visitor_count);
  return {
    visitor_count: visitors,
    new_visitor_count: number(sessionRow.new_visitor_count),
    returning_visitor_count: returningVisitors,
    returning_visitor_rate: visitors ? Math.round((returningVisitors / visitors) * 1000) / 10 : 0,
    session_count: sessions,
    event_count: events,
    events_per_session: sessions ? Math.round((events / sessions) * 10) / 10 : 0,
    average_session_duration_ms: Math.round(number(sessionRow.average_session_duration_ms)),
    median_field_dwell_ms: Math.round(number(eventRow.average_field_dwell_ms)),
    typed_character_count: typed,
    correction_count: corrections,
    correction_rate: typed ? Math.round((corrections / typed) * 1000) / 10 : 0,
    touch_interaction_count: number(eventRow.touch_interaction_count),
    completed_session_count: number(eventRow.completed_session_count),
    completion_rate: sessions ? Math.round((number(eventRow.completed_session_count) / sessions) * 1000) / 10 : 0,
    friction_session_count: number(eventRow.friction_session_count)
  };
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
}

function metadata(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function fieldDwellMs(details) {
  if (Number.isFinite(details.dwell_before_input_ms) && details.dwell_before_input_ms >= 0) {
    return details.dwell_before_input_ms;
  }
  const changed = number(details.key_press_count) > 0
    || number(details.edit_count) > 0
    || number(details.paste_count) > 0;
  return changed ? null : number(details.duration_ms);
}

export function buildLiveAnalytics(sessions = [], events = [], journeys = []) {
  const actions = new Map();
  const controls = new Map();
  const fieldDwell = [];
  let typedCharacters = 0;
  let corrections = 0;
  let touchInteractions = 0;

  for (const event of events) {
    const details = metadata(event.metadata_json);
    actions.set(event.action, (actions.get(event.action) ?? 0) + 1);
    controls.set(event.element_key, (controls.get(event.element_key) ?? 0) + 1);
    if (event.action === 'field.blur') {
      const dwell = fieldDwellMs(details);
      if (dwell !== null) fieldDwell.push(dwell);
      typedCharacters += number(details.key_press_count);
      corrections += number(details.backspace_count);
    }
    if (details.pointer_type === 'touch') touchInteractions += 1;
  }

  return {
    session_count: sessions.length,
    returning_session_count: sessions.filter((session) => Boolean(session.is_returning_visitor)).length,
    event_count: events.length,
    median_field_dwell_ms: median(fieldDwell),
    typed_character_count: typedCharacters,
    correction_count: corrections,
    touch_interaction_count: touchInteractions,
    dimension_scores: medianDimensionScores(journeys.map((journey) => journey.dimension_scores).filter(Boolean)),
    actions: [...actions.entries()].map(([action, count]) => ({ action, count })).sort((left, right) => right.count - left.count || left.action.localeCompare(right.action)),
    controls: [...controls.entries()].map(([element_key, count]) => ({ element_key, count })).sort((left, right) => right.count - left.count || left.element_key.localeCompare(right.element_key)).slice(0, 10)
  };
}
import { medianDimensionScores } from './session-dimensions.mjs';
