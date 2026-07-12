import assert from 'node:assert/strict';
import test from 'node:test';

import { presentEvent } from '../src/product/router.mjs';

test('rebuilds stored journey narratives when they are read', () => {
  const event = presentEvent({
    session_id: 'session-1234',
    event_class: 'input',
    action: 'field.blur',
    role: 'field',
    element_key: 'auto.textarea.textarea.38',
    metadata_json: JSON.stringify({ duration_ms: 28800, key_press_count: 101, pointer_type: 'mouse' }),
    narrative: 'Type on field “auto textarea textarea 38”, using mouse.',
    occurred_at_ms: 1234,
  });

  assert.equal(
    event.narrative,
    'After dwelling for 28.8s, typed 101 characters in an unlabelled text area using a keyboard. Focus left using a mouse.',
  );
  assert.equal(event.metadata_json, JSON.stringify({ duration_ms: 28800, key_press_count: 101, pointer_type: 'mouse' }));
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
