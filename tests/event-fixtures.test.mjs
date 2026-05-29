import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const schema = JSON.parse(readFileSync('contracts/events/flux-event.schema.json', 'utf8'));
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

function checkType(value, expectedType) {
  if (expectedType === 'integer') return Number.isInteger(value);
  if (expectedType === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === expectedType;
}

function validateEvent(event) {
  const errors = [];

  for (const field of schema.required) {
    if (!Object.hasOwn(event, field)) errors.push(`missing required field: ${field}`);
  }

  if (schema.additionalProperties === false) {
    for (const field of Object.keys(event)) {
      if (!Object.hasOwn(schema.properties, field)) errors.push(`additional field not allowed: ${field}`);
    }
  }

  for (const [field, value] of Object.entries(event)) {
    const rules = schema.properties[field];
    if (!rules) continue;

    if (rules.type && !checkType(value, rules.type)) errors.push(`${field} has invalid type`);
    if (Object.hasOwn(rules, 'const') && value !== rules.const) errors.push(`${field} must equal ${rules.const}`);
    if (rules.enum && !rules.enum.includes(value)) errors.push(`${field} is not in allowed enum`);
    if (rules.pattern && typeof value === 'string' && !(new RegExp(rules.pattern).test(value))) errors.push(`${field} does not match pattern`);
    if (typeof value === 'string' && rules.minLength && value.length < rules.minLength) errors.push(`${field} shorter than minLength`);
    if (typeof value === 'string' && rules.maxLength && value.length > rules.maxLength) errors.push(`${field} longer than maxLength`);
    if (typeof value === 'number' && Object.hasOwn(rules, 'minimum') && value < rules.minimum) errors.push(`${field} below minimum`);
    if (typeof value === 'number' && Object.hasOwn(rules, 'maximum') && value > rules.maximum) errors.push(`${field} above maximum`);
  }

  if (errors.length) {
    const message = errors.join('; ');
    throw new Error(message);
  }
}

test('valid event fixtures satisfy the baseline event schema', () => {
  const fixtures = readJsonFiles(validDir);
  assert.equal(fixtures.length, 7);

  for (const fixture of fixtures) {
    assert.doesNotThrow(() => validateEvent(fixture.data), fixture.file);
  }
});

test('invalid event fixtures are rejected by the baseline event schema', () => {
  const fixtures = readJsonFiles(invalidDir);
  assert.equal(fixtures.length, 7);

  for (const fixture of fixtures) {
    assert.throws(() => validateEvent(fixture.data), undefined, fixture.file);
  }
});

test('invalid fixtures cover no-consent and content-bearing telemetry risks', () => {
  const invalidFiles = readJsonFiles(invalidDir).map((fixture) => fixture.file);
  assert.deepEqual(invalidFiles, [
    'clipboard-text.json',
    'consent-no.json',
    'email-field.json',
    'file-name.json',
    'password-field.json',
    'typed-value.json',
    'unknown-event-class.json'
  ]);
});
