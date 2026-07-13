import test from 'node:test';
import assert from 'node:assert/strict';

import { handleProductRequest } from '../src/product/router.mjs';

async function sessionCookie(accountId, secret) {
  const expires = Date.now() + 60000;
  const value = `${accountId}.${expires}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${secret}:${value}`));
  const signature = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `flux_session=${value}.${signature}`;
}

test('aggregate export requires an authenticated tenant account', async () => {
  const response = await handleProductRequest(new Request('https://flux.example/api/dashboard/researchops/export.csv'), {
    FLUX_DB: {}, FLUX_AUTH_SECRET: 'secret'
  });
  assert.equal(response.status, 401);
});

test('aggregate export refuses raw-event report names', async () => {
  const secret = 'secret';
  const db = { prepare() { return { bind() { return this; }, async first() { return { allowed: 1 }; } }; } };
  const response = await handleProductRequest(new Request('https://flux.example/api/dashboard/researchops/export.csv?report=raw_events', {
    headers: { cookie: await sessionCookie('account-1', secret) }
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: 'unsupported_export_report' });
});

test('authorised overview export returns bounded CSV with provenance and download controls', async () => {
  const secret = 'secret';
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes('account_tenants')) return { allowed: 1 };
          if (sql.includes('service_model_versions')) return null;
          if (sql.includes('COUNT(DISTINCT visitor_id)')) return { visitor_count: 8, new_visitor_count: 5, returning_visitor_count: 3, session_count: 10, average_session_duration_ms: 42000 };
          if (sql.includes('average_field_dwell_ms')) return { event_count: 50, completed_session_count: 6, friction_session_count: 2 };
          throw new Error(`Unexpected query: ${sql}`);
        }
      };
    }
  };
  const response = await handleProductRequest(new Request('https://flux.example/api/dashboard/researchops/export.csv?report=overview&range=30d', {
    headers: { cookie: await sessionCookie('account-1', secret) }
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });
  const csv = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/csv; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-disposition'), /flux-researchops-overview-30d\.csv/);
  assert.match(csv, /visitor_count/);
  assert.match(csv, /event_schema_version/);
  assert.doesNotMatch(csv, /session_id|visitor_id|metadata_json|narrative/);
});
