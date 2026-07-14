import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('tenant administration stores reversible trash state and an audit trail', () => {
  const migration = readFileSync('migrations/0008_tenant_administration.sql', 'utf8');

  assert.match(migration, /ALTER TABLE tenants ADD COLUMN deleted_at_ms INTEGER/);
  assert.match(migration, /ALTER TABLE tenants ADD COLUMN purge_after_ms INTEGER/);
  assert.match(migration, /ALTER TABLE tenants ADD COLUMN deleted_by_account_id TEXT/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS tenant_admin_audit/);
  assert.match(migration, /action TEXT NOT NULL/);
  assert.match(migration, /created_at_ms INTEGER NOT NULL/);
  assert.doesNotMatch(migration, /DELETE FROM (?:events|sessions|visitors|tenants)/);
});
