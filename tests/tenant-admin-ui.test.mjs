import test from 'node:test';
import assert from 'node:assert/strict';

import { createTenantAdminClient, originsFromTextarea } from '../src/admin/tenant-admin.mjs';

test('admin origin input becomes a trimmed non-empty origin list', () => {
  assert.deepEqual(originsFromTextarea(' https://one.example \n\nhttps://two.example\n'), [
    'https://one.example',
    'https://two.example'
  ]);
});

test('admin client creates a tenant through the authenticated administration API', async () => {
  const calls = [];
  const client = createTenantAdminClient(async (url, options = {}) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ ok: true, tenant_id: 'licence-service' }), { headers: { 'content-type': 'application/json' } });
  });

  await client.create({ tenant_id: 'licence-service', name: 'Licence service', allowed_origins: ['https://service.example'] });

  assert.equal(calls[0].url, '/api/admin/tenants');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.credentials, 'include');
  assert.deepEqual(JSON.parse(calls[0].options.body), { tenant_id: 'licence-service', name: 'Licence service', allowed_origins: ['https://service.example'] });
});

test('admin client maps tenant settings, access and trash lifecycle to scoped APIs', async () => {
  const calls = [];
  const client = createTenantAdminClient(async (url, options = {}) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  });

  await client.list();
  await client.update('licence-service', { name: 'Licence', allowed_origins: ['https://service.example'] });
  await client.access('licence-service');
  await client.grant('licence-service', { email: 'viewer@example.gov.uk', role: 'viewer' });
  await client.removeAccess('licence-service', 'google:123');
  await client.trash('licence-service');
  await client.restore('licence-service');

  assert.deepEqual(calls.map(({ url, options }) => [url, options.method]), [
    ['/api/admin/tenants', 'GET'],
    ['/api/admin/tenants/licence-service', 'PATCH'],
    ['/api/admin/tenants/licence-service/access', 'GET'],
    ['/api/admin/tenants/licence-service/access', 'PUT'],
    ['/api/admin/tenants/licence-service/access/google%3A123', 'DELETE'],
    ['/api/admin/tenants/licence-service', 'DELETE'],
    ['/api/admin/tenants/licence-service/restore', 'POST']
  ]);
  assert.deepEqual(JSON.parse(calls[5].options.body), { confirmation: 'licence-service' });
});
