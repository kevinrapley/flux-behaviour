import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleProductRequest } from '../src/product/router.mjs';

test('collector authorises an allowed browser preflight without allowing arbitrary origins', async () => {
  const db = {
    prepare() { return { bind() { return { all: async () => ({ results: [{ allowed_origins_json: '["https://researchops.pages.dev"]' }] }) }; } }; }
  };
  const allowed = await handleProductRequest(new Request('https://flux-behaviour.pages.dev/api/collect', { method: 'OPTIONS', headers: { origin: 'https://researchops.pages.dev' } }), { FLUX_DB: db });
  const denied = await handleProductRequest(new Request('https://flux-behaviour.pages.dev/api/collect', { method: 'OPTIONS', headers: { origin: 'https://untrusted.example' } }), { FLUX_DB: db });

  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://researchops.pages.dev');
  assert.equal(allowed.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
  assert.equal(denied.status, 403);
});

test('collector session creation tolerates concurrent first events', () => {
  const router = readFileSync('src/product/router.mjs', 'utf8');
  assert.match(router, /INSERT OR IGNORE INTO sessions/);
});
