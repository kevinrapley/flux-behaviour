import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyCollectorBoundary, createBoundaryPolicy, createBoundaryPolicyFromEnv } from '../src/collector/boundary-controls.mjs';
import { handleCollectorRequest } from '../src/collector/router.mjs';
import worker from '../src/cloudflare/worker.mjs';

function request(path, init = {}) {
  return new Request(`https://worker.example.test${path}`, init);
}

async function json(response) {
  return response.json();
}

test('boundary policy reads allowed origins and body size from env shape', () => {
  const policy = createBoundaryPolicyFromEnv({
    FLUX_ALLOWED_ORIGINS: 'https://service.example, https://admin.example',
    FLUX_MAX_BODY_BYTES: '1024'
  });

  assert.deepEqual(policy.allowedOrigins, ['https://service.example', 'https://admin.example']);
  assert.equal(policy.maxBodyBytes, 1024);
});

test('collector boundary handles valid preflight for collect route', async () => {
  const policy = createBoundaryPolicy({ allowedOrigins: ['https://service.example'] });
  const response = await applyCollectorBoundary(request('/collect', {
    method: 'OPTIONS',
    headers: {
      origin: 'https://service.example',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type'
    }
  }), policy, handleCollectorRequest);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://service.example');
  assert.equal(response.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
  assert.equal(response.headers.get('access-control-allow-headers'), 'content-type');
});

test('collector boundary rejects disallowed origins', async () => {
  const policy = createBoundaryPolicy({ allowedOrigins: ['https://service.example'] });
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  const response = await applyCollectorBoundary(request('/collect', {
    method: 'POST',
    headers: {
      origin: 'https://attacker.example',
      'content-type': 'application/json'
    },
    body: JSON.stringify(event)
  }), policy, handleCollectorRequest);
  const body = await json(response);

  assert.equal(response.status, 403);
  assert.equal(body.error.code, 'origin_not_allowed');
});

test('collector boundary allows configured origin and preserves no-storage response', async () => {
  const policy = createBoundaryPolicy({ allowedOrigins: ['https://service.example'] });
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  const response = await applyCollectorBoundary(request('/collect', {
    method: 'POST',
    headers: {
      origin: 'https://service.example',
      'content-type': 'application/json'
    },
    body: JSON.stringify(event)
  }), policy, handleCollectorRequest);
  const body = await json(response);

  assert.equal(response.status, 202);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://service.example');
  assert.equal(body.stored, false);
});

test('collector boundary rejects oversized requests before validation', async () => {
  const policy = createBoundaryPolicy({
    allowedOrigins: ['https://service.example'],
    maxBodyBytes: 10
  });
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  const response = await applyCollectorBoundary(request('/collect', {
    method: 'POST',
    headers: {
      origin: 'https://service.example',
      'content-type': 'application/json',
      'content-length': '1000'
    },
    body: JSON.stringify(event)
  }), policy, handleCollectorRequest);
  const body = await json(response);

  assert.equal(response.status, 413);
  assert.equal(body.error.code, 'request_too_large');
});

test('collector boundary rejects oversized requests without content length', async () => {
  const policy = createBoundaryPolicy({
    allowedOrigins: ['https://service.example'],
    maxBodyBytes: 10
  });
  const response = await applyCollectorBoundary(request('/collect', {
    method: 'POST',
    headers: {
      origin: 'https://service.example',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ payload: 'this-body-is-too-large' })
  }), policy, handleCollectorRequest);
  const body = await json(response);

  assert.equal(response.status, 413);
  assert.equal(body.error.code, 'request_too_large');
});

test('collector boundary rejects rate-limited requests through stub interface', async () => {
  const policy = createBoundaryPolicy({
    allowedOrigins: ['https://service.example'],
    rateLimiter: {
      async check() {
        return { allowed: false };
      }
    }
  });
  const event = JSON.parse(readFileSync('fixtures/events/valid/focus-enter.json', 'utf8'));
  const response = await applyCollectorBoundary(request('/collect', {
    method: 'POST',
    headers: {
      origin: 'https://service.example',
      'content-type': 'application/json'
    },
    body: JSON.stringify(event)
  }), policy, handleCollectorRequest);
  const body = await json(response);

  assert.equal(response.status, 429);
  assert.equal(body.error.code, 'rate_limited');
});

test('worker adapter keeps health route available without collect CORS headers', async () => {
  const response = await worker.fetch(request('/health'), {
    FLUX_ALLOWED_ORIGINS: 'https://service.example'
  }, {});
  const body = await json(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.storage, 'disabled');
  assert.equal(response.headers.has('access-control-allow-origin'), false);
});
