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

function validModel() {
  return {
    schema_version: '1.0.0', tenant_id: 'researchops', model_key: 'model.researchops', version: 1,
    entities: [
      { key: 'service.researchops', type: 'service', label: 'ResearchOps', position: 1 },
      { key: 'transaction.projects', type: 'transaction', label: 'Manage projects', parent_key: 'service.researchops', position: 1 },
      { key: 'task.objective', type: 'task', label: 'Edit objective', parent_key: 'transaction.projects', position: 1 },
      { key: 'step.objective', type: 'step', label: 'Describe objective', parent_key: 'task.objective', position: 1 },
      { key: 'question.objective', type: 'question', label: 'Project objective', parent_key: 'step.objective', position: 1, complexity: 4 },
      { key: 'field.objective', type: 'field', label: 'Objective editor', parent_key: 'question.objective', position: 1, required: true }
    ],
    bindings: [
      { element_key: 'field.project.objective.edit', entity_key: 'field.objective' },
      { element_key: 'form.project.add-objective', entity_key: 'step.objective' }
    ],
    outcomes: [
      { key: 'outcome.objective-saved', label: 'Objective saved', transaction_key: 'transaction.projects', type: 'success' }
    ],
    key_events: [
      { key: 'key-event.objective-saved', label: 'Objective saved', action: 'flow.submit', element_key: 'form.project.add-objective', outcome_key: 'outcome.objective-saved' }
    ]
  };
}

function ownerDb({ owner = true, existing = false } = {}) {
  const batches = [];
  return {
    batches,
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          if (sql.includes('account_tenants')) return owner ? { role: 'owner' } : { role: 'viewer' };
          if (sql.includes('service_model_versions')) return existing ? { version: 1 } : null;
          return null;
        }
      };
    },
    async batch(statements) { batches.push(statements); return statements.map(() => ({ success: true })); }
  };
}

test('publisher model route requires an authenticated dashboard account', async () => {
  const response = await handleProductRequest(
    new Request('https://flux-behaviour.pages.dev/api/service-model/researchops', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    }),
    { FLUX_DB: {}, FLUX_AUTH_SECRET: 'test-secret' }
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: 'unauthorised' });
});

test('tenant owner can publish a matching service model version', async () => {
  const secret = 'test-secret';
  const db = ownerDb();
  const response = await handleProductRequest(
    new Request('https://flux-behaviour.pages.dev/api/service-model/researchops', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: await sessionCookie('account-1', secret) },
      body: JSON.stringify(validModel())
    }),
    { FLUX_DB: db, FLUX_AUTH_SECRET: secret }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true, model_key: 'model.researchops', version: 1 });
  assert.equal(db.batches.length, 1);
});

test('authorised tenant account can read the currently published service model', async () => {
  const secret = 'test-secret';
  const model = validModel();
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes('account_tenants')) return { role: 'viewer' };
          if (sql.includes('service_model_versions')) return { model_json: JSON.stringify(model), manifest_hash: 'sha256-value' };
          return null;
        }
      };
    }
  };
  const response = await handleProductRequest(
    new Request('https://flux-behaviour.pages.dev/api/service-model/researchops', {
      headers: { cookie: await sessionCookie('viewer-1', secret) }
    }),
    { FLUX_DB: db, FLUX_AUTH_SECRET: secret }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, model, manifest_hash: 'sha256-value', role: 'viewer' });
});

test('publisher route returns forbidden for a tenant viewer', async () => {
  const secret = 'test-secret';
  const response = await handleProductRequest(
    new Request('https://flux-behaviour.pages.dev/api/service-model/researchops', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: await sessionCookie('viewer-1', secret) },
      body: JSON.stringify(validModel())
    }),
    { FLUX_DB: ownerDb({ owner: false }), FLUX_AUTH_SECRET: secret }
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { ok: false, error: 'forbidden' });
});

test('publisher route reports a conflict instead of overwriting an existing version', async () => {
  const secret = 'test-secret';
  const response = await handleProductRequest(
    new Request('https://flux-behaviour.pages.dev/api/service-model/researchops', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: await sessionCookie('owner-1', secret) },
      body: JSON.stringify(validModel())
    }),
    { FLUX_DB: ownerDb({ existing: true }), FLUX_AUTH_SECRET: secret }
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { ok: false, error: 'service_model_version_exists' });
});

test('service-model routes reject extra path segments instead of treating them as a tenant identifier', async () => {
  const response = await handleProductRequest(
    new Request('https://flux-behaviour.pages.dev/api/service-model/researchops/private'),
    { FLUX_DB: {}, FLUX_AUTH_SECRET: 'test-secret' }
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, error: 'not_found' });
});
