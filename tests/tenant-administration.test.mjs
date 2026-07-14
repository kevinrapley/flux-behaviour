import test from 'node:test';
import assert from 'node:assert/strict';

import {
  restoreTenantTracking,
  tenantAggregateCsv,
  trashTenantTracking,
  validTenantSettings
} from '../src/tenants/tenant-administration.mjs';

function recordingDb() {
  const batches = [];
  return {
    batches,
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; }
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ success: true }));
    }
  };
}

test('moving a tenant to trash stops collection without deleting its analytics', async () => {
  const db = recordingDb();
  const result = await trashTenantTracking(db, 'licence-service', 'admin-1', { now: () => 1_750_000_000_000, randomUUID: () => '11111111-1111-4111-8111-111111111111' });

  assert.deepEqual(result, { ok: true, status: 'trashed', purge_after_ms: 1_753_024_000_000 });
  assert.equal(db.batches.length, 1);
  assert.match(db.batches[0][0].sql, /UPDATE tenants SET deleted_at_ms/);
  assert.match(db.batches[0][1].sql, /UPDATE tenant_installation_tags SET revoked_at_ms/);
  assert.match(db.batches[0][2].sql, /INSERT INTO tenant_admin_audit/);
  assert.doesNotMatch(db.batches.map((batch) => batch.map(({ sql }) => sql).join(' ')).join(' '), /DELETE FROM/);
});

test('restoring a tenant clears trash state and reactivates its existing tag', async () => {
  const db = recordingDb();
  const result = await restoreTenantTracking(db, 'licence-service', 'admin-1', { now: () => 1_750_000_000_000, randomUUID: () => '22222222-2222-4222-8222-222222222222' });

  assert.deepEqual(result, { ok: true, status: 'active' });
  assert.match(db.batches[0][0].sql, /deleted_at_ms = NULL/);
  assert.match(db.batches[0][1].sql, /revoked_at_ms = NULL/);
});

test('tenant settings accept controlled names and exact origins only', () => {
  assert.equal(validTenantSettings({ name: 'Licence service', allowedOrigins: ['https://service.example', 'http://localhost:4321'] }), true);
  assert.equal(validTenantSettings({ name: 'Licence service', allowedOrigins: ['https://service.example/path'] }), false);
  assert.equal(validTenantSettings({ name: 'https://bad.example', allowedOrigins: ['https://service.example'] }), false);
});

test('tenant aggregate CSV contains daily counts and no visitor or session identifiers', () => {
  const csv = tenantAggregateCsv({
    tenantId: 'licence-service',
    generatedAt: '2026-07-14T20:00:00.000Z',
    rows: [{ day: '2026-07-14', visitors: 8, sessions: 10, interactions: 42 }]
  });

  assert.match(csv, /day,visitors,sessions,interactions/);
  assert.match(csv, /2026-07-14,8,10,42/);
  assert.doesNotMatch(csv, /visitor_id|session_id|event_id/);
  assert.match(csv, /Aggregate service evidence/);
});
