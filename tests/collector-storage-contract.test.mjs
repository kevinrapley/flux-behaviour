import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDisabledEventStore, createStorageCandidate, STORAGE_DECISION, STORAGE_STATUS, validateStorageCandidate } from '../src/collector/storage-contract.mjs';
import { handleCollectorRequest } from '../src/collector/router.mjs';

function request(path, init = {}) {
  return new Request(`https://collector.example.test${path}`, init);
}

async function json(response) {
  return response.json();
}

test('storage candidate uses disabled status by default', () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  const candidate = createStorageCandidate(event, {
    received_at_ms: 1760000000000,
    source: 'collector-test'
  });

  assert.equal(candidate.schema_version, '1.0.0');
  assert.equal(candidate.received_at_ms, 1760000000000);
  assert.equal(candidate.source, 'collector-test');
  assert.equal(candidate.storage_status, STORAGE_STATUS.DISABLED);
  assert.deepEqual(candidate.event, event);
});

test('storage candidate validation rejects non-disabled records', () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  const candidate = createStorageCandidate(event, {
    received_at_ms: 1760000000000
  });
  candidate.storage_status = STORAGE_STATUS.READY;

  const result = validateStorageCandidate(candidate);

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('storage_status must remain disabled until a storage PR introduces bindings'));
});

test('disabled event store never stores valid candidates', async () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  const candidate = createStorageCandidate(event, {
    received_at_ms: 1760000000000
  });
  const store = createDisabledEventStore();
  const result = await store.put(candidate);

  assert.equal(store.status, STORAGE_STATUS.DISABLED);
  assert.equal(result.stored, false);
  assert.equal(result.decision, STORAGE_DECISION.STORAGE_DISABLED);
  assert.equal(result.storage, STORAGE_STATUS.DISABLED);
});

test('disabled event store rejects invalid candidates without storing', async () => {
  const store = createDisabledEventStore();
  const result = await store.put({});

  assert.equal(result.stored, false);
  assert.equal(result.decision, STORAGE_DECISION.INVALID_RECORD);
  assert.ok(result.errors.length > 0);
});

test('collector route still accepts valid events without storage writes', async () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  const response = await handleCollectorRequest(request('/collect', {
    method: 'POST',
    body: JSON.stringify(event)
  }));
  const body = await json(response);

  assert.equal(response.status, 202);
  assert.equal(body.accepted, true);
  assert.equal(body.stored, false);
  assert.equal(body.storage, STORAGE_STATUS.DISABLED);
});
