import assert from 'node:assert/strict';
import test from 'node:test';

import { presentEvent, presentJourneyEvents } from '../src/product/router.mjs';

test('rebuilds stored journey narratives when they are read', () => {
  const event = presentEvent({
    session_id: 'session-1234',
    event_class: 'input',
    action: 'field.blur',
    role: 'field',
    element_key: 'auto.textarea.textarea.38',
    metadata_json: JSON.stringify({
      duration_ms: 28800,
      dwell_before_input_ms: 1400,
      typing_duration_ms: 26000,
      key_press_count: 101,
      backspace_count: 3,
      words_per_minute: 47,
      revisit_count: 2,
      pointer_type: 'mouse',
    }),
    narrative: 'Type on field “auto textarea textarea 38”, using mouse.',
    occurred_at_ms: 1234,
  });

  assert.equal(
    event.narrative,
    'After dwelling for 1.4s without interacting, typed 101 characters in an unlabelled text area over 26s at 47 words per minute. Used Backspace or Delete 3 times. This was the second visit to the field. Focus left using a mouse.',
  );
  assert.match(event.metadata_json, /"dwell_before_input_ms":1400/);
});

test('handles malformed stored metadata without exposing a generated key', () => {
  const event = presentEvent({
    event_class: 'nav',
    action: 'control.click',
    role: 'control',
    element_key: 'auto.a.4',
    metadata_json: '{bad json',
    narrative: 'Click on control “auto a 4”.',
  });

  assert.equal(event.narrative, 'Clicked an unlabelled link.');
});

test('preserves a stored neutral authentication milestone outcome', () => {
  const event = presentEvent({
    session_id: 'session-1234',
    event_class: 'trust',
    action: 'auth.otp.succeeded',
    role: 'service',
    element_key: 'auth.otp',
    metadata_json: JSON.stringify({
      schema_version: '1.2.0',
      consent: 'yes',
      origin: 'sdk',
      event_class: 'trust',
      action: 'auth.otp.succeeded',
      role: 'service',
      element_key: 'auth.otp',
      timestamp_ms: 1234,
    }),
    narrative: 'Successfully verified the one-time code and signed in.',
    occurred_at_ms: 1234,
  });

  assert.equal(event.narrative, 'Successfully verified the one-time code and signed in.');
});

test('collapses historical Tab runs to the final destination before an interaction', () => {
  const events = presentJourneyEvents([
    { action: 'control.tab', role: 'control', element_key: 'link.navigation.home', metadata_json: '{}', occurred_at_ms: 1 },
    { action: 'control.tab', role: 'control', element_key: 'link.navigation.sourcebook', metadata_json: '{}', occurred_at_ms: 2 },
    { action: 'control.click', role: 'control', element_key: 'link.navigation.sourcebook', metadata_json: '{"pointer_type":"keyboard"}', occurred_at_ms: 3 },
  ]);

  assert.deepEqual(events.map(({ action, element_key }) => [action, element_key]), [
    ['control.tab', 'link.navigation.sourcebook'],
    ['control.click', 'link.navigation.sourcebook'],
  ]);
  assert.equal(events[1].narrative, 'Opened the Sourcebook link using a keyboard.');
});

test('collapses Tab runs independently for interleaved sessions', () => {
  const events = presentJourneyEvents([
    { session_id: 'session-a', action: 'control.tab', role: 'control', element_key: 'link.navigation.home', metadata_json: '{}', occurred_at_ms: 1 },
    { session_id: 'session-b', action: 'control.tab', role: 'control', element_key: 'link.navigation.projects', metadata_json: '{}', occurred_at_ms: 2 },
    { session_id: 'session-a', action: 'control.click', role: 'control', element_key: 'link.navigation.home', metadata_json: '{}', occurred_at_ms: 3 },
    { session_id: 'session-b', action: 'control.click', role: 'control', element_key: 'link.navigation.projects', metadata_json: '{}', occurred_at_ms: 4 },
  ]);

  assert.deepEqual(events.map(({ session_id, action }) => [session_id, action]), [
    ['session-a', 'control.tab'],
    ['session-b', 'control.tab'],
    ['session-a', 'control.click'],
    ['session-b', 'control.click'],
  ]);
});
