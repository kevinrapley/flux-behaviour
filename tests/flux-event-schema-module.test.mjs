import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fluxEventSchema } from '../src/events/flux-event-schema.mjs';

test('importable event schema matches the JSON contract', () => {
  const contract = JSON.parse(readFileSync('contracts/events/flux-event.schema.json', 'utf8'));

  assert.deepEqual(fluxEventSchema, contract);
});
