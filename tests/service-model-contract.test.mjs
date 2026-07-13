import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('publisher service model contract fixes hierarchy, complexity and privacy-safe binding boundaries', () => {
  const schema = JSON.parse(readFileSync('contracts/models/flux-service-model.schema.json', 'utf8'));

  assert.equal(schema.additionalProperties, false);
  assert.ok(schema.required.includes('outcomes'));
  assert.ok(schema.required.includes('key_events'));
  assert.equal(schema.properties.schema_version.const, '1.0.0');
  assert.deepEqual(schema.properties.entities.items.properties.type.enum, [
    'service',
    'transaction',
    'task',
    'step',
    'question',
    'field'
  ]);
  assert.deepEqual(schema.$defs.complexity, { type: 'integer', minimum: 1, maximum: 7 });
  assert.equal(schema.properties.entities.items.properties.label.pattern, '^(?!.*https?:)[^@\\r\\n]+$');
  assert.equal(schema.properties.entities.items.allOf.length, 2);
  assert.deepEqual(schema.properties.entities.items.allOf[0].then.required, ['complexity']);
  assert.deepEqual(schema.properties.entities.items.allOf[0].else.not.required, ['complexity']);
  assert.deepEqual(schema.properties.entities.items.allOf[1].then.required, ['required']);
  assert.deepEqual(schema.properties.entities.items.allOf[1].else.not.required, ['required']);
  assert.equal(schema.properties.bindings.items.properties.element_key.pattern, '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$');
  assert.deepEqual(schema.properties.outcomes.items.properties.type.enum, ['success', 'failure', 'progress', 'abandonment']);
  assert.deepEqual(schema.properties.key_events.items.required, ['key', 'label', 'action', 'element_key', 'outcome_key']);
});

test('publisher service model permits a tenant owner to begin with no configured funnels', () => {
  const schema = JSON.parse(readFileSync('contracts/models/flux-service-model.schema.json', 'utf8'));

  assert.equal(schema.properties.outcomes.minItems, undefined);
  assert.equal(schema.properties.key_events.minItems, undefined);
});
