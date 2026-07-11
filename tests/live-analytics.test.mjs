import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLiveAnalytics } from '../src/product/live-analytics.mjs';

test('live analytics aggregates consented metadata without exposing event contents', () => {
  const result = buildLiveAnalytics(
    [{ id: 'session-new', is_returning_visitor: 0 }, { id: 'session-returning', is_returning_visitor: 1 }],
    [
      { action: 'field.blur', element_key: 'auto.input.text.1', metadata_json: JSON.stringify({ duration_ms: 1200, key_press_count: 9, backspace_count: 2 }) },
      { action: 'field.blur', element_key: 'auto.input.text.1', metadata_json: JSON.stringify({ duration_ms: 800, key_press_count: 4, backspace_count: 1 }) },
      { action: 'control.click', element_key: 'auto.button.button.2', metadata_json: JSON.stringify({ pointer_type: 'touch' }) }
    ]
  );

  assert.deepEqual(result, {
    session_count: 2,
    returning_session_count: 1,
    event_count: 3,
    median_field_dwell_ms: 1000,
    typed_character_count: 13,
    correction_count: 3,
    touch_interaction_count: 1,
    actions: [{ action: 'field.blur', count: 2 }, { action: 'control.click', count: 1 }],
    controls: [{ element_key: 'auto.input.text.1', count: 2 }, { element_key: 'auto.button.button.2', count: 1 }]
  });
});
