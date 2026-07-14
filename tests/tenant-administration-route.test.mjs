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

test('platform administrators can list active and trashed tenants', async () => {
  const secret = 'test-secret';
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() { return sql.includes('platform_admins') ? { allowed: 1 } : null; },
        async all() {
          return { results: [
            { id: 'active-service', name: 'Active service', allowed_origins_json: '["https://active.example"]', created_at_ms: 1, deleted_at_ms: null, purge_after_ms: null, tag_id: 'flux-active', role: 'owner' },
            { id: 'old-service', name: 'Old service', allowed_origins_json: '["https://old.example"]', created_at_ms: 2, deleted_at_ms: 3, purge_after_ms: 4, tag_id: 'flux-old', role: null }
          ] };
        }
      };
    }
  };
  const response = await handleProductRequest(new Request('https://flux.example/api/admin/tenants', {
    headers: { cookie: await sessionCookie('admin-1', secret) }
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.platform_admin, true);
  assert.deepEqual(body.tenants.map(({ id, status }) => ({ id, status })), [
    { id: 'active-service', status: 'active' },
    { id: 'old-service', status: 'trashed' }
  ]);
  assert.deepEqual(body.tenants[0].allowed_origins, ['https://active.example']);
});

test('tenant owners can update property details and exact allowed origins', async () => {
  const secret = 'test-secret';
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          if (sql.includes('platform_admins')) return null;
          if (sql.includes('account_tenants')) return { role: 'owner' };
          if (sql.includes('FROM tenants')) return { id: 'licence-service', deleted_at_ms: null };
          return null;
        }
      };
    },
    async batch(statements) { batches.push(statements); return statements.map(() => ({ success: true })); }
  };
  const response = await handleProductRequest(new Request('https://flux.example/api/admin/tenants/licence-service', {
    method: 'PATCH',
    headers: { cookie: await sessionCookie('owner-1', secret), 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Updated licence service', allowed_origins: ['https://licence.example'] })
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, tenant_id: 'licence-service', status: 'active' });
  assert.match(batches[0][0].sql, /UPDATE tenants SET name = \?, allowed_origins_json = \?/);
  assert.match(batches[0][1].sql, /tenant_admin_audit/);
});

test('tenant owners move tracking to trash only after exact confirmation', async () => {
  const secret = 'test-secret';
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          if (sql.includes('platform_admins')) return null;
          if (sql.includes('account_tenants')) return { role: 'owner' };
          if (sql.includes('FROM tenants')) return { id: 'licence-service', deleted_at_ms: null };
          return null;
        }
      };
    },
    async batch(statements) { batches.push(statements); return statements.map(() => ({ success: true })); }
  };
  const denied = await handleProductRequest(new Request('https://flux.example/api/admin/tenants/licence-service', {
    method: 'DELETE',
    headers: { cookie: await sessionCookie('owner-1', secret), 'content-type': 'application/json' },
    body: JSON.stringify({ confirmation: 'wrong-service' })
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });
  assert.equal(denied.status, 400);
  assert.equal(batches.length, 0);

  const response = await handleProductRequest(new Request('https://flux.example/api/admin/tenants/licence-service', {
    method: 'DELETE',
    headers: { cookie: await sessionCookie('owner-1', secret), 'content-type': 'application/json' },
    body: JSON.stringify({ confirmation: 'licence-service' })
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'trashed');
  assert.match(batches[0][0].sql, /deleted_at_ms/);
  assert.match(batches[0][1].sql, /revoked_at_ms/);
});

test('tenant owners can restore trashed tracking with its existing tag', async () => {
  const secret = 'test-secret';
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        sql,
        bind() { return this; },
        async first() {
          if (sql.includes('platform_admins')) return null;
          if (sql.includes('account_tenants')) return { role: 'owner' };
          if (sql.includes('FROM tenants')) return { id: 'licence-service', deleted_at_ms: 1 };
          return null;
        }
      };
    },
    async batch(statements) { batches.push(statements); return statements.map(() => ({ success: true })); }
  };
  const response = await handleProductRequest(new Request('https://flux.example/api/admin/tenants/licence-service/restore', {
    method: 'POST',
    headers: { cookie: await sessionCookie('owner-1', secret) }
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, status: 'active' });
  assert.match(batches[0][1].sql, /revoked_at_ms = NULL/);
});

test('tenant members can export bounded aggregate daily data without raw identifiers', async () => {
  const secret = 'test-secret';
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        sql,
        bind() { return this; },
        async first() {
          if (sql.includes('account_tenants')) return { role: 'viewer' };
          if (sql.includes('FROM tenants')) return { id: 'licence-service', deleted_at_ms: null };
          return null;
        },
        async all() {
          return { results: [{ day: '2026-07-14', visitors: 8, sessions: 10, interactions: 42 }] };
        }
      };
    },
    async batch(statements) { batches.push(statements); return statements.map(() => ({ success: true })); }
  };
  const response = await handleProductRequest(new Request('https://flux.example/api/admin/tenants/licence-service/export.csv', {
    headers: { cookie: await sessionCookie('viewer-1', secret) }
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });

  const csv = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /flux-licence-service-aggregate/);
  assert.match(csv, /2026-07-14,8,10,42/);
  assert.doesNotMatch(csv, /visitor_id|session_id|event_id/);
  assert.match(batches[0][0].sql, /action, created_at_ms/);
});

test('tenant owners can list property access roles', async () => {
  const secret = 'test-secret';
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes('platform_admins')) return null;
          if (sql.includes('account_tenants')) return { role: 'owner' };
          return null;
        },
        async all() { return { results: [{ account_id: 'viewer-1', email: 'viewer@example.gov.uk', role: 'viewer' }] }; }
      };
    }
  };
  const response = await handleProductRequest(new Request('https://flux.example/api/admin/tenants/licence-service/access', {
    headers: { cookie: await sessionCookie('owner-1', secret) }
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).access, [{ account_id: 'viewer-1', email: 'viewer@example.gov.uk', role: 'viewer' }]);
});

test('tenant owners can grant an existing account a property role', async () => {
  const secret = 'test-secret';
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          if (sql.includes('platform_admins')) return null;
          if (sql.includes('account_id = ? AND tenant_id = ?')) return { role: 'owner' };
          if (sql.includes('tenant_id = ? AND account_id = ?')) return null;
          if (sql.includes('FROM accounts')) return { id: 'viewer-1' };
          if (sql.includes('FROM tenants')) return { id: 'licence-service', deleted_at_ms: null };
          return null;
        }
      };
    },
    async batch(statements) { batches.push(statements); return statements.map(() => ({ success: true })); }
  };
  const response = await handleProductRequest(new Request('https://flux.example/api/admin/tenants/licence-service/access', {
    method: 'PUT',
    headers: { cookie: await sessionCookie('owner-1', secret), 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'VIEWER@example.gov.uk', role: 'viewer' })
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, tenant_id: 'licence-service', account_id: 'viewer-1', role: 'viewer' });
  assert.match(batches[0][0].sql, /ON CONFLICT\(account_id, tenant_id\) DO UPDATE SET role = excluded\.role/);
  assert.match(batches[0][1].sql, /access_updated/);
});

test('tenant administration refuses to demote the final owner', async () => {
  const secret = 'test-secret';
  let batchCalls = 0;
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes('platform_admins')) return null;
          if (sql.includes('FROM tenants')) return { id: 'licence-service', deleted_at_ms: null };
          if (sql.includes('FROM accounts')) return { id: 'owner-1' };
          if (sql.includes('tenant_id = ? AND account_id = ?')) return { role: 'owner' };
          if (sql.includes('COUNT(*)')) return { count: 1 };
          if (sql.includes('account_id = ? AND tenant_id = ?')) return { role: 'owner' };
          return null;
        }
      };
    },
    async batch() { batchCalls += 1; }
  };
  const response = await handleProductRequest(new Request('https://flux.example/api/admin/tenants/licence-service/access', {
    method: 'PUT',
    headers: { cookie: await sessionCookie('owner-1', secret), 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.gov.uk', role: 'viewer' })
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { ok: false, error: 'last_owner_required' });
  assert.equal(batchCalls, 0);
});

test('tenant owners can remove viewer access without orphaning the property', async () => {
  const secret = 'test-secret';
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        sql,
        bind() { return this; },
        async first() {
          if (sql.includes('platform_admins')) return null;
          if (sql.includes('account_id = ? AND tenant_id = ?') && sql.includes('SELECT role')) return { role: 'owner' };
          if (sql.includes('tenant_id = ? AND account_id = ?')) return { role: 'viewer' };
          return null;
        }
      };
    },
    async batch(statements) { batches.push(statements); return statements.map(() => ({ success: true })); }
  };
  const response = await handleProductRequest(new Request('https://flux.example/api/admin/tenants/licence-service/access/viewer-1', {
    method: 'DELETE',
    headers: { cookie: await sessionCookie('owner-1', secret) }
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, tenant_id: 'licence-service', account_id: 'viewer-1' });
  assert.match(batches[0][0].sql, /DELETE FROM account_tenants/);
});

test('tenant administration refuses to remove the final owner', async () => {
  const secret = 'test-secret';
  let batchCalls = 0;
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes('platform_admins')) return null;
          if (sql.includes('account_id = ? AND tenant_id = ?') && sql.includes('SELECT role')) return { role: 'owner' };
          if (sql.includes('tenant_id = ? AND account_id = ?')) return { role: 'owner' };
          if (sql.includes('COUNT(*)')) return { count: 1 };
          return null;
        }
      };
    },
    async batch() { batchCalls += 1; }
  };
  const response = await handleProductRequest(new Request('https://flux.example/api/admin/tenants/licence-service/access/owner-1', {
    method: 'DELETE', headers: { cookie: await sessionCookie('owner-1', secret) }
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { ok: false, error: 'last_owner_required' });
  assert.equal(batchCalls, 0);
});
