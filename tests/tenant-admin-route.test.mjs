import test from 'node:test';
import assert from 'node:assert/strict';

import { handleProductRequest } from '../src/product/router.mjs';

async function sessionCookie(accountId, secret) {
  const expires = Date.now() + 60_000;
  const value = `${accountId}.${expires}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${secret}:${value}`));
  const signature = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `flux_session=${value}.${signature}`;
}

test('tenant provisioning requires an authenticated platform admin', async () => {
  const response = await handleProductRequest(new Request('https://flux-behaviour.pages.dev/api/admin/tenants', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  }), { FLUX_DB: {}, FLUX_AUTH_SECRET: 'test-secret' });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: 'unauthorised' });
});

test('tenant provisioning rejects an authenticated account without platform-admin authority', async () => {
  const secret = 'test-secret';
  const db = {
    prepare(sql) {
      return {
        bind() {
          return { first: async () => sql.includes('platform_admins') ? null : null };
        }
      };
    }
  };
  const response = await handleProductRequest(new Request('https://flux-behaviour.pages.dev/api/admin/tenants', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: await sessionCookie('account-1', secret) },
    body: '{}'
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { ok: false, error: 'forbidden' });
});

test('platform admin receives the new tenant unique installation tag', async () => {
  const secret = 'test-secret';
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() { return sql.includes('platform_admins') ? { allowed: 1 } : null; }
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ success: true }));
    }
  };
  const response = await handleProductRequest(new Request('https://flux-behaviour.pages.dev/api/admin/tenants', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: await sessionCookie('admin-1', secret) },
    body: JSON.stringify({
      tenant_id: 'licence-service',
      name: 'Licence service',
      allowed_origins: ['https://service.example']
    })
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });

  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.ok, true);
  assert.equal(body.tenant_id, 'licence-service');
  assert.match(body.tag_id, /^flux-[a-f0-9]{32}$/);
  assert.equal(body.installation.attribute, 'data-flux-tag');
  assert.match(body.installation.script, new RegExp(`data-flux-tag="${body.tag_id}"`));
  assert.match(body.installation.script, /data-flux-endpoint="https:\/\/flux-behaviour\.pages\.dev\/api\/collect"/);
  assert.doesNotMatch(body.installation.script, /data-flux-tenant/);
  assert.equal(batches.length, 1);
});

test('tenant provisioning reports a conflict instead of replacing an existing tenant or tag', async () => {
  const secret = 'test-secret';
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() { return sql.includes('platform_admins') ? { allowed: 1 } : null; }
      };
    },
    async batch() { throw new Error('UNIQUE constraint failed: tenants.id'); }
  };
  const response = await handleProductRequest(new Request('https://flux-behaviour.pages.dev/api/admin/tenants', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: await sessionCookie('admin-1', secret) },
    body: JSON.stringify({ tenant_id: 'researchops', name: 'Replacement', allowed_origins: ['https://replacement.example'] })
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { ok: false, error: 'tenant_exists' });
});

test('tenant provisioning does not misreport an operational database failure as a conflict', async () => {
  const secret = 'test-secret';
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() { return sql.includes('platform_admins') ? { allowed: 1 } : null; }
      };
    },
    async batch() { throw new Error('D1_ERROR: database unavailable'); }
  };
  const response = await handleProductRequest(new Request('https://flux-behaviour.pages.dev/api/admin/tenants', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: await sessionCookie('admin-1', secret) },
    body: JSON.stringify({ tenant_id: 'licence-service', name: 'Licence service', allowed_origins: ['https://service.example'] })
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { ok: false, error: 'tenant_provisioning_failed' });
});
