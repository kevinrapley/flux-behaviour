import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('D1 indexes model-version context for event and semantic entity reports', () => {
  const migration = readFileSync('migrations/0006_event_entity_reports.sql', 'utf8');

  assert.match(migration, /CREATE INDEX IF NOT EXISTS event_service_contexts_by_model_period_lookup/);
  assert.match(migration, /ON event_service_contexts\(tenant_id, model_key, model_version, event_id\)/);
});
