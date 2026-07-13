import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('D1 records server acceptance time for realtime freshness and indexed windows', () => {
  const migration = readFileSync('migrations/0005_event_ingestion_time.sql', 'utf8');

  assert.match(migration, /ALTER TABLE events ADD COLUMN accepted_at_ms INTEGER/);
  assert.match(migration, /UPDATE events\s+SET accepted_at_ms = occurred_at_ms\s+WHERE accepted_at_ms IS NULL/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS events_by_tenant_acceptance\s+ON events\(tenant_id, accepted_at_ms DESC\)/);
});
