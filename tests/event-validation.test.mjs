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
    schema_version: '1.0.0',
    session_id: 'session-invalid-unsafe',
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
    schema_version: '1.0.0',
    session_id: 'session-invalid-key',
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
