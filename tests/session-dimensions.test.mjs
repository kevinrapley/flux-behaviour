import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreSessionDimensions, SESSION_DIMENSIONS } from '../src/product/session-dimensions.mjs';

test('every session receives all twenty demo-model indicators without event contents', () => {
  const result = scoreSessionDimensions([
    { action: 'field.blur', element_key: 'auto.input.text.1', metadata_json: JSON.stringify({ duration_ms: 12000, dwell_before_input_ms: 2000, typing_duration_ms: 8000, chars_per_minute: 225, key_press_count: 30, backspace_count: 10, edit_count: 12 }) },
    { action: 'control.tab', element_key: 'auto.input.text.1', metadata_json: '{}' },
    { action: 'edit.paste', element_key: 'auto.textarea.2', metadata_json: '{}' },
    { action: 'assist.help', element_key: 'auto.details.3', metadata_json: '{}' },
    { action: 'flow.submit', element_key: 'form.projects', metadata_json: '{}' }
  ]);

  assert.equal(result.dimensions.length, 20);
  assert.deepEqual(result.dimensions.map(({ key }) => key), SESSION_DIMENSIONS.map(({ key }) => key));
  assert.equal(result.dimensions.find(({ key }) => key === 'engagement').score > 50, true);
  assert.equal(result.dimensions.find(({ key }) => key === 'frustration').score > 50, true);
  assert.equal(result.dimensions.find(({ key }) => key === 'sustainability').score > 50, true);
  assert.equal(result.composites.length, 5);
});

test('unsupported dimensions remain neutral instead of being inferred', () => {
  const result = scoreSessionDimensions([]);
  assert.equal(result.dimensions.every(({ score }) => score === 50), true);
  assert.equal(result.composites.every(({ score }) => score === 50), true);
});
