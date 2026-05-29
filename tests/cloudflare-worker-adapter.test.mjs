import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../src/cloudflare/worker.mjs';

function request(path, init = {}) {
  return new Request(`https://worker.example.test${path}`, init);
}

async function json(response) {
  return response.json();
}

test('Cloudflare Worker adapter delegates health requests to collector router', async () => {
  const response = await worker.fetch(request('/health'), {}, {});
  const body = await json(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, 'flux-behaviour-collector');
  assert.equal(body.storage, 'disabled');
});

test('Cloudflare Worker adapter accepts valid collect requests without storage', async () => {
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  const response = await worker.fetch(request('/collect', {
    method: 'POST',
    body: JSON.stringify(event)
  }), {}, {});
  const body = await json(response);

  assert.equal(response.status, 202);
  assert.equal(body.ok, true);
  assert.equal(body.accepted, true);
  assert.equal(body.stored, false);
});

test('Cloudflare Worker adapter rejects invalid collect requests safely', async () => {
  const event = JSON.parse(readFileSync('fixtures/events/invalid/typed-value.json', 'utf8'));
  const response = await worker.fetch(request('/collect', {
    method: 'POST',
    body: JSON.stringify(event)
  }), {}, {});
  const body = await json(response);

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'validation_failed');
  assert.equal(JSON.stringify(body).includes('value'), false);
});
