import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleCollectorRequest } from '../src/collector/router.mjs';

function request(path, init = {}) {
  return new Request(`https://collector.example.test${path}`, init);
}

async function json(response) {
  return response.json();
}

test('collector health route returns scaffold status', async () => {
  const response = await handleCollectorRequest(request('/health'));
  const body = await json(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, 'flux-behaviour-collector');
  assert.equal(body.status, 'scaffold');
  assert.equal(body.storage, 'disabled');
});

test('collector health route rejects unsupported methods', async () => {
  const response = await handleCollectorRequest(request('/health', { method: 'POST' }));
  const body = await json(response);

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.equal(body.error.code, 'method_not_allowed');
});

test('collector collect route accepts valid metadata-only event without storing it', async () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  const response = await handleCollectorRequest(request('/collect', {
    method: 'POST',
    body: JSON.stringify(event)
  }));
  const body = await json(response);

  assert.equal(response.status, 202);
  assert.equal(body.ok, true);
  assert.equal(body.accepted, true);
  assert.equal(body.stored, false);
  assert.equal(body.storage, 'disabled');
});

test('collector collect route rejects unsupported methods', async () => {
  const response = await handleCollectorRequest(request('/collect'));
  const body = await json(response);

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
  assert.equal(body.error.code, 'method_not_allowed');
});

test('collector collect route rejects invalid JSON', async () => {
  const response = await handleCollectorRequest(request('/collect', {
    method: 'POST',
    body: '{'
  }));
  const body = await json(response);

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'invalid_json');
});

test('collector collect route returns safe validation errors', async () => {
  const event = JSON.parse(readFileSync('fixtures/events/invalid/typed-value.json', 'utf8'));
  const response = await handleCollectorRequest(request('/collect', {
    method: 'POST',
    body: JSON.stringify(event)
  }));
  const body = await json(response);

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'validation_failed');
  assert.ok(body.error.details.some((detail) => detail.code === 'additional_property'));
  assert.equal(JSON.stringify(body).includes('value'), false);
});

test('collector collect route caps validation detail responses', async () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));

  for (let index = 0; index < 25; index += 1) {
    event[`extra_${index}`] = '';
  }

  const response = await handleCollectorRequest(request('/collect', {
    method: 'POST',
    body: JSON.stringify(event)
  }));
  const body = await json(response);

  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'validation_failed');
  assert.ok(body.error.details.length <= 10);
  assert.equal(JSON.stringify(body).includes('extra_24'), false);
});

test('collector returns not found for unknown routes', async () => {
  const response = await handleCollectorRequest(request('/missing'));
  const body = await json(response);

  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'not_found');
});
