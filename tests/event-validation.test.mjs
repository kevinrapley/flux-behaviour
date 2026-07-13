import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EVENT_VALIDATION_ERROR_CODES, loadEventSchema, validateEvent } from '../src/events/index.mjs';

const schema = loadEventSchema();
const validDir = 'fixtures/events/valid';
const invalidDir = 'fixtures/events/invalid';

function readJsonFiles(dir) {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      file,
      data: JSON.parse(readFileSync(join(dir, file), 'utf8'))
    }));
}

test('event validation accepts valid fixture events', () => {
  for (const fixture of readJsonFiles(validDir)) {
    const result = validateEvent(fixture.data, schema);
    assert.equal(result.valid, true, fixture.file);
    assert.deepEqual(result.errors, []);
  }
});

test('event validation rejects invalid fixture events', () => {
  for (const fixture of readJsonFiles(invalidDir)) {
    const result = validateEvent(fixture.data, schema);
    assert.equal(result.valid, false, fixture.file);
    assert.ok(result.errors.length > 0, fixture.file);
  }
});

test('event validation reports structured errors without submitted values', () => {
  const event = {
    schema_version: '1.2.0',
    session_id: 'session-invalid-unsafe',
    visitor_id: 'visitor-invalid-unsafe',
    tenant_id: 'researchops',
    consent: 'yes',
    origin: 'formkit',
    event_class: 'input',
    action: 'input.change',
    role: 'field',
    element_key: 'application.reference-number',
    timestamp_ms: 1760000011200,
    value: 'do-not-echo-this'
  };

  const result = validateEvent(event, schema);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => {
    return error.code === EVENT_VALIDATION_ERROR_CODES.ADDITIONAL_PROPERTY && error.field === null;
  }));

  const serialisedErrors = JSON.stringify(result.errors);
  assert.equal(serialisedErrors.includes('do-not-echo-this'), false);
  assert.equal(serialisedErrors.includes('value'), false);
});

test('event validation does not echo untrusted additional-property names', () => {
  const event = {
    schema_version: '1.2.0',
    session_id: 'session-invalid-key',
    visitor_id: 'visitor-invalid-key',
    tenant_id: 'researchops',
    consent: 'yes',
    origin: 'formkit',
    event_class: 'input',
    action: 'input.change',
    role: 'field',
    element_key: 'application.reference-number',
    timestamp_ms: 1760000011200,
    'unsafe-dynamic-field': ''
  };

  const result = validateEvent(event, schema);
  const serialisedErrors = JSON.stringify(result.errors);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => {
    return error.code === EVENT_VALIDATION_ERROR_CODES.ADDITIONAL_PROPERTY && error.field === null;
  }));
  assert.equal(serialisedErrors.includes('unsafe-dynamic-field'), false);
});

test('event validation rejects no-consent events explicitly', () => {
  const fixture = JSON.parse(readFileSync('fixtures/events/invalid/consent-no.json', 'utf8'));
  const result = validateEvent(fixture, schema);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => {
    return error.code === EVENT_VALIDATION_ERROR_CODES.INVALID_CONST && error.field === 'consent';
  }));
});

test('event validation rejects non-object events', () => {
  const result = validateEvent(null, schema);

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [{
    code: EVENT_VALIDATION_ERROR_CODES.NOT_OBJECT,
    field: null,
    message: 'Event must be a JSON object.'
  }]);
});

test('event validation rejects optional metadata on authentication milestones', () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  Object.assign(event, {
    event_class: 'trust',
    action: 'auth.otp.succeeded',
    role: 'service',
    element_key: 'auth.otp',
    value_length: 6,
  });

  const result = validateEvent(event, schema);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === EVENT_VALIDATION_ERROR_CODES.PRIVACY_POLICY));
});

test('event validation accepts a content-free sensitive autocomplete milestone', () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  Object.assign(event, {
    event_class: 'trust',
    action: 'field.autocomplete.email.used',
    role: 'service',
    element_key: 'autocomplete.email',
  });
  delete event.duration_ms;

  assert.deepEqual(validateEvent(event, schema), { valid: true, errors: [] });
});

test('event validation rejects metadata on sensitive autocomplete milestones', () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  Object.assign(event, {
    event_class: 'trust',
    action: 'field.autocomplete.email.used',
    role: 'service',
    element_key: 'autocomplete.email',
    value_length: 24,
  });

  const result = validateEvent(event, schema);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === EVENT_VALIDATION_ERROR_CODES.PRIVACY_POLICY));
});

test('event validation rejects authentication form submits', () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  Object.assign(event, {
    event_class: 'nav',
    action: 'flow.submit',
    role: 'form',
    element_key: 'form.auth.otp-verify',
  });

  const result = validateEvent(event, schema);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === EVENT_VALIDATION_ERROR_CODES.PRIVACY_POLICY));
});

test('event validation rejects authentication control interactions', () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  Object.assign(event, {
    event_class: 'nav',
    action: 'control.click',
    role: 'control',
    element_key: 'button.auth.verify-code',
  });

  const result = validateEvent(event, schema);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === EVENT_VALIDATION_ERROR_CODES.PRIVACY_POLICY));
});

test('event validation rejects case-variant authentication controls', () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  Object.assign(event, {
    event_class: 'nav',
    action: 'control.click',
    role: 'control',
    element_key: 'button.Auth.verify-code',
  });

  const result = validateEvent(event, schema);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === EVENT_VALIDATION_ERROR_CODES.PRIVACY_POLICY));
});

test('event validation rejects nested authentication scopes', () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  Object.assign(event, {
    event_class: 'nav',
    action: 'control.click',
    role: 'control',
    element_key: 'control.navigation.Auth.verify',
  });

  const result = validateEvent(event, schema);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === EVENT_VALIDATION_ERROR_CODES.PRIVACY_POLICY));
});

test('event validation rejects underscore-separated authentication scopes', () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  Object.assign(event, {
    event_class: 'nav',
    action: 'control.click',
    role: 'control',
    element_key: 'control_navigation_auth_verify',
  });

  const result = validateEvent(event, schema);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === EVENT_VALIDATION_ERROR_CODES.PRIVACY_POLICY));
});

test('event validation reserves auth.otp for neutral milestones', () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  Object.assign(event, {
    event_class: 'nav',
    action: 'control.click',
    role: 'control',
    element_key: 'auth.otp',
  });

  const result = validateEvent(event, schema);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === EVENT_VALIDATION_ERROR_CODES.PRIVACY_POLICY));
});

test('event validation rejects unchanged field lengths', () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  Object.assign(event, {
    event_class: 'input',
    action: 'field.blur',
    role: 'field',
    element_key: 'field.case.reference',
    value_length: 12,
    key_press_count: 0,
    edit_count: 0,
    paste_count: 0,
  });

  const result = validateEvent(event, schema);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === EVENT_VALIDATION_ERROR_CODES.PRIVACY_POLICY));
});

test('event validation accepts a complete UK English writing signal bundle', () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  Object.assign(event, {
    event_class: 'input',
    action: 'field.blur',
    role: 'field',
    element_key: 'field.project.objective-editor',
    writing_language: 'en-GB',
    word_count: 12,
    spelling_issue_count: 1,
    grammar_issue_count: 2,
    uppercase_letter_count: 3,
    lowercase_letter_count: 54,
    all_caps_word_count: 0,
  });

  assert.equal(validateEvent(event, schema).valid, true);
});

test('event validation rejects an incomplete writing signal bundle', () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  Object.assign(event, {
    event_class: 'input',
    action: 'field.blur',
    role: 'field',
    element_key: 'field.project.objective-editor',
    writing_language: 'en-GB',
    word_count: 12,
  });

  const result = validateEvent(event, schema);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === EVENT_VALIDATION_ERROR_CODES.PRIVACY_POLICY));
});
