import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = JSON.parse(readFileSync('contracts/events/flux-event.schema.json', 'utf8'));

function validateRequiredFields(event) {
  for (const field of schema.required) {
    assert.ok(Object.hasOwn(event, field), `missing ${field}`);
  }
}

test('event schema declares metadata-only consented event contract', () => {
  assert.equal(schema.title, 'Flux Behaviour event');
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.consent.const, 'yes');
  assert.deepEqual(schema.properties.event_class.enum, [
    'focus',
    'input',
    'nav',
    'kbd',
    'clipboard',
    'drop',
    'file',
    'picker',
    'trust',
    'assist',
    'a11y',
    'env'
  ]);
  assert.deepEqual(schema.properties.dwell_before_input_ms, {
    type: 'integer',
    minimum: 0,
    maximum: 3600000
  });
  assert.deepEqual(schema.properties.typing_duration_ms, {
    type: 'integer',
    minimum: 0,
    maximum: 3600000
  });
  assert.deepEqual(schema.properties.writing_language, { type: 'string', const: 'en-GB' });
  for (const field of [
    'word_count',
    'spelling_issue_count',
    'grammar_issue_count',
    'uppercase_letter_count',
    'lowercase_letter_count',
    'all_caps_word_count'
  ]) {
    assert.deepEqual(schema.properties[field], {
      type: 'integer',
      minimum: 0,
      maximum: 10000
    });
  }
});

test('representative event satisfies required baseline fields', () => {
  const event = {
    schema_version: '1.2.0',
    session_id: 'session-1234',
    visitor_id: 'visitor-1234',
    tenant_id: 'researchops',
    consent: 'yes',
    origin: 'formkit',
    event_class: 'focus',
    action: 'focus.enter',
    role: 'field',
    element_key: 'application.reference-number',
    timestamp_ms: 1760000000000,
    duration_ms: 1200
  };

  validateRequiredFields(event);
  assert.equal(event.consent, schema.properties.consent.const);
  assert.ok(schema.properties.event_class.enum.includes(event.event_class));
  assert.ok(schema.properties.role.enum.includes(event.role));
});

test('event schema does not permit content-bearing field names', () => {
  const prohibited = ['value', 'text', 'content', 'password', 'email', 'name', 'clipboard_text', 'file_name'];
  for (const field of prohibited) {
    assert.equal(Object.hasOwn(schema.properties, field), false, `${field} must not be in event schema`);
  }
});
