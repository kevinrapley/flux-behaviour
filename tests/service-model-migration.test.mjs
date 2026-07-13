import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('D1 migration stores immutable model versions, normalised entities, bindings and event-time context', () => {
  const migration = readFileSync('migrations/0003_publisher_service_model.sql', 'utf8');

  assert.match(migration, /CREATE TABLE IF NOT EXISTS service_model_versions/);
  assert.match(migration, /PRIMARY KEY \(tenant_id, model_key, version\)/);
  assert.match(migration, /status TEXT NOT NULL CHECK \(status IN \('draft', 'published', 'retired'\)\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS service_model_entities/);
  assert.match(migration, /complexity INTEGER CHECK \(complexity BETWEEN 1 AND 7\)/);
  assert.match(migration, /required INTEGER CHECK \(required IN \(0, 1\)\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS service_model_bindings/);
  assert.match(migration, /PRIMARY KEY \(tenant_id, model_key, version, element_key\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS service_model_outcomes/);
  assert.match(migration, /outcome_type TEXT NOT NULL CHECK \(outcome_type IN \('success', 'failure', 'progress', 'abandonment'\)\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS service_model_key_events/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS event_service_contexts/);
  assert.match(migration, /event_id TEXT PRIMARY KEY REFERENCES events\(id\)/);
  assert.match(migration, /transaction_complexity REAL/);
  assert.match(migration, /key_event_key TEXT/);
  assert.match(migration, /outcome_key TEXT/);
  assert.match(migration, /outcome_type TEXT CHECK \(outcome_type IN \('success', 'failure', 'progress', 'abandonment'\)\)/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS events_by_tenant_period\s+ON events\(tenant_id, occurred_at_ms\)/);
});
