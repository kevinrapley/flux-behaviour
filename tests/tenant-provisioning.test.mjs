import test from 'node:test';
import assert from 'node:assert/strict';

import { generateTenantTag, provisionTenant } from '../src/tenants/tenant-provisioning.mjs';

test('each generated tenant installation tag is distinct and contract-safe', () => {
  const values = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  ];

  const first = generateTenantTag(() => values.shift());
  const second = generateTenantTag(() => values.shift());

  assert.equal(first, 'flux-11111111111141118111111111111111');
  assert.equal(second, 'flux-22222222222242228222222222222222');
  assert.notEqual(first, second);
  assert.match(first, /^[a-z][a-z0-9-]{2,79}$/);
});

test('tenant tag generation rejects a malformed randomness source', () => {
  assert.throws(
    () => generateTenantTag(() => 'not-a-uuid'),
    { name: 'RangeError', message: 'invalid_tenant_tag_source' }
  );
});

test('tenant provisioning atomically creates the tenant, unique tag and owner membership', async () => {
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) { return { sql, values }; }
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ success: true }));
    }
  };

  const result = await provisionTenant(db, {
    tenantId: 'licence-service',
    name: 'Licence service',
    allowedOrigins: ['https://service.example'],
    ownerAccountId: 'account-1'
  }, {
    now: () => 1_750_000_000_000,
    randomUUID: () => '33333333-3333-4333-8333-333333333333'
  });

  assert.deepEqual(result, {
    ok: true,
    tenant_id: 'licence-service',
    tag_id: 'flux-33333333333343338333333333333333'
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 4);
  assert.match(batches[0][0].sql, /INSERT INTO tenants/);
  assert.deepEqual(batches[0][0].values, ['licence-service', 'Licence service', '["https://service.example"]', 1_750_000_000_000]);
  assert.match(batches[0][1].sql, /INSERT INTO tenant_installation_tags/);
  assert.deepEqual(batches[0][1].values, ['flux-33333333333343338333333333333333', 'licence-service', 1_750_000_000_000]);
  assert.match(batches[0][2].sql, /INSERT INTO account_tenants/);
  assert.deepEqual(batches[0][2].values, ['account-1', 'licence-service', 'owner']);
  assert.match(batches[0][3].sql, /INSERT INTO tenant_admin_audit/);
  assert.deepEqual(batches[0][3].values.slice(1), ['licence-service', 'account-1', 1_750_000_000_000]);
});

test('tenant provisioning rejects unsafe identifiers and non-origin URLs before database access', async () => {
  const db = { prepare() { throw new Error('must not query'); } };

  const result = await provisionTenant(db, {
    tenantId: 'Tenant One',
    name: 'Tenant\nOne',
    allowedOrigins: ['https://service.example/private?token=value'],
    ownerAccountId: 'account-1'
  });

  assert.deepEqual(result, { ok: false, error: 'invalid_tenant' });
});
