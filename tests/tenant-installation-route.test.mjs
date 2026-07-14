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

test('tenant owner can retrieve the stable installation tag for an existing tenant', async () => {
  const secret = 'test-secret';
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes('account_tenants')) return { role: 'owner' };
          if (sql.includes('tenant_installation_tags')) return { tag_id: 'flux-researchops' };
          return null;
        }
      };
    }
  };
  const response = await handleProductRequest(new Request('https://flux-behaviour.pages.dev/api/tenant/researchops/installation', {
    headers: { cookie: await sessionCookie('owner-1', secret) }
  }), { FLUX_DB: db, FLUX_AUTH_SECRET: secret });

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.tenant_id, 'researchops');
  assert.equal(body.tag_id, 'flux-researchops');
  assert.equal(body.installation.attribute, 'data-flux-tag');
  assert.match(body.installation.script, /data-flux-tag="flux-researchops"/);
  assert.doesNotMatch(body.installation.script, /data-flux-tenant/);
});
