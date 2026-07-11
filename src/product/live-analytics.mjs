function number(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
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

export function buildLiveAnalytics(sessions = [], events = []) {
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
      fieldDwell.push(number(details.duration_ms));
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
    actions: [...actions.entries()].map(([action, count]) => ({ action, count })).sort((left, right) => right.count - left.count || left.action.localeCompare(right.action)),
    controls: [...controls.entries()].map(([element_key, count]) => ({ element_key, count })).sort((left, right) => right.count - left.count || left.element_key.localeCompare(right.element_key)).slice(0, 10)
  };
}
