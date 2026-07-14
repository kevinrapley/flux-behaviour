import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('tenant installation tags are one-to-one and ResearchOps keeps its existing tenant identity', () => {
  const migration = readFileSync('migrations/0007_tenant_installation_tags.sql', 'utf8');

  assert.match(migration, /CREATE TABLE IF NOT EXISTS tenant_installation_tags/);
  assert.match(migration, /tag_id TEXT PRIMARY KEY/);
  assert.match(migration, /tenant_id TEXT NOT NULL UNIQUE REFERENCES tenants\(id\)/);
  assert.match(migration, /VALUES \('flux-researchops', 'researchops'/);
  assert.match(migration, /SELECT 'flux-existing-' \|\| tenants\.rowid, tenants\.id/);
  assert.doesNotMatch(migration, /randomblob/);
  assert.match(migration, /WHERE tenants\.id != 'researchops'/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS platform_admins/);
  assert.match(migration, /account_id TEXT PRIMARY KEY REFERENCES accounts\(id\)/);
  assert.doesNotMatch(migration, /UPDATE tenants\s+SET id/);
  assert.doesNotMatch(migration, /DELETE FROM tenants/);
});
