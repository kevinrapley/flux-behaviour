import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveTenantReference } from '../src/tenants/tenant-tags.mjs';
import { handleProductRequest } from '../src/product/router.mjs';

test('collector resolves an active installation tag to its internal tenant', async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          calls.push({ sql, values });
          return {
            async first() {
              return {
                id: 'licence-service',
                allowed_origins_json: '["https://service.example"]'
              };
            }
          };
        }
      };
    }
  };

  const tenant = await resolveTenantReference(db, 'flux-11111111111141118111111111111111');

  assert.deepEqual(tenant, {
    id: 'licence-service',
    allowed_origins_json: '["https://service.example"]'
  });
  assert.match(calls[0].sql, /tenant_installation_tags/);
  assert.match(calls[0].sql, /revoked_at_ms IS NULL/);
  assert.deepEqual(calls[0].values, ['flux-11111111111141118111111111111111']);
});

test('collector preserves the legacy ResearchOps tenant reference during migration', async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          calls.push({ sql, values });
          return {
            async first() {
              if (sql.includes('tenant_installation_tags')) return null;
              return { id: 'researchops', allowed_origins_json: '["https://researchops.pages.dev"]' };
            }
          };
        }
      };
    }
  };

  const tenant = await resolveTenantReference(db, 'researchops');

  assert.equal(tenant.id, 'researchops');
  assert.equal(calls.length, 2);
  assert.match(calls[1].sql, /FROM tenants WHERE id = 'researchops'/);
});

test('collector stores a tagged event under the resolved internal tenant', async () => {
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          if (sql.includes('tenant_installation_tags')) {
            return { id: 'licence-service', allowed_origins_json: '["https://service.example"]' };
          }
          return null;
        }
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ success: true }));
    }
  };
  const event = {
    schema_version: '1.2.0',
    session_id: 'session-tagged-001',
    visitor_id: 'visitor-tagged-001',
    tenant_id: 'flux-11111111111141118111111111111111',
    consent: 'yes',
    origin: 'sdk',
    event_class: 'nav',
    action: 'page.loaded',
    role: 'page',
    element_key: 'page.home',
    timestamp_ms: 1_750_000_000_000
  };

  const response = await handleProductRequest(new Request('https://flux-behaviour.pages.dev/api/collect', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://service.example' },
    body: JSON.stringify(event)
  }), { FLUX_DB: db });

  assert.equal(response.status, 202);
  assert.equal(batches.length, 1);
  const visitorInsert = batches[0].find((statement) => statement.sql.includes('INSERT INTO visitors'));
  const sessionInsert = batches[0].find((statement) => statement.sql.includes('INSERT OR IGNORE INTO sessions'));
  const eventInsert = batches[0].find((statement) => statement.sql.includes('INSERT INTO events'));
  assert.equal(visitorInsert.values[0], 'licence-service');
  assert.equal(sessionInsert.values[1], 'licence-service');
  assert.equal(eventInsert.values[1], 'licence-service');
});
